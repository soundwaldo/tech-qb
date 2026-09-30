import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth/server";

type Row = Record<string, unknown>;

type RowInput = Record<string, unknown>;
type FilterOperator = "eq" | "in";

type QueryState = {
    table: string;
    op: "select" | "insert" | "update" | "upsert" | "delete";
    columns?: string;
    values?: Row | Row[];
    filters: Array<{ column: string; operator: FilterOperator; value: unknown }>;
    orderBy?: { column: string; ascending: boolean };
    limitN?: number;
    conflictColumn?: string;
};

const memoryStore = new Map<string, Row[]>();

const jsonbColumns = new Set(["findings", "quote_analysis", "manifest", "payload"]);

function getDbClient(): ((query: string) => Promise<unknown>) | null {
    const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!url) return null;
    const client = neon(url);
    return async (query: string) => client.query(query);
}

function isSafeIdentifier(value: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function escapeIdentifier(value: string): string {
    if (!isSafeIdentifier(value)) throw new Error(`Unsafe identifier: ${value}`);
    return `"${value}"`;
}

function escapeLiteral(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (Array.isArray(value)) {
        if (value.length === 0) return "ARRAY[]::text[]";
        const serialized = value.map((item) => escapeLiteral(item)).join(", ");
        return `ARRAY[${serialized}]`;
    }
    if (typeof value === "object") {
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    const text = String(value).replace(/'/g, "''");
    return `'${text}'`;
}

function escapeColumnValue(column: string, value: unknown): string {
    if (jsonbColumns.has(column) && value !== null && typeof value === "object") {
        return `${escapeLiteral(JSON.stringify(value))}::jsonb`;
    }
    return escapeLiteral(value);
}

function serializeColumns(columns?: string): string {
    if (!columns || columns === "*") return "*";
    return columns.split(",").map((column) => column.trim()).filter(Boolean).join(", ");
}

function compileWhere(filters: Array<{ column: string; operator: FilterOperator; value: unknown }>): string {
    if (!filters.length) return "";
    const clauses = filters.map((filter) => {
        const column = escapeIdentifier(filter.column);
        if (filter.operator === "in") {
            const values = Array.isArray(filter.value) ? filter.value : [filter.value];
            const list = values.map((value) => escapeLiteral(value)).join(", ");
            return `${column} IN (${list})`;
        }
        return `${column} = ${escapeLiteral(filter.value)}`;
    });
    return ` WHERE ${clauses.join(" AND ")}`;
}

function compileOrder(orderBy?: { column: string; ascending: boolean }): string {
    if (!orderBy) return "";
    return ` ORDER BY ${escapeIdentifier(orderBy.column)} ${orderBy.ascending ? "ASC" : "DESC"}`;
}

function compileLimit(limitN?: number): string {
    if (!limitN || limitN < 1) return "";
    return ` LIMIT ${Math.floor(limitN)}`;
}

function ensureTable(table: string): string {
    if (!isSafeIdentifier(table)) throw new Error(`Unsafe table name: ${table}`);
    return table;
}

function normalizeRow(row: Row): Row {
    return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

async function runWithDb(state: QueryState): Promise<Row[] | null> {
    const db = getDbClient();
    if (!db) return null;

    const table = ensureTable(state.table);
    switch (state.op) {
        case "select": {
            const columns = serializeColumns(state.columns);
            const where = compileWhere(state.filters);
            const order = compileOrder(state.orderBy);
            const limit = compileLimit(state.limitN);
            const query = `SELECT ${columns} FROM ${escapeIdentifier(table)}${where}${order}${limit}`;
            const rows = await db(query);
            return Array.isArray(rows) ? rows as Row[] : [];
        }
        case "insert": {
            const records = (Array.isArray(state.values) ? state.values : [state.values || {}]).map(normalizeRow);
            if (!records.length || !Object.keys(records[0]).length) return [];
            const keys = Object.keys(records[0]);
            const columns = keys.map(escapeIdentifier).join(", ");
            const placeholders = records.map((row) => `(${keys.map((key) => escapeColumnValue(key, row[key])).join(", ")})`).join(", ");
            const query = `INSERT INTO ${escapeIdentifier(table)} (${columns}) VALUES ${placeholders} RETURNING *`;
            const rows = await db(query);
            return Array.isArray(rows) ? rows as Row[] : [];
        }
        case "update": {
            const values = state.values && !Array.isArray(state.values) ? normalizeRow(state.values) : {};
            if (!Object.keys(values).length) return [];
            const assignments = Object.entries(values).map(([key, value]) => `${escapeIdentifier(key)} = ${escapeColumnValue(key, value)}`).join(", ");
            const where = compileWhere(state.filters);
            const query = `UPDATE ${escapeIdentifier(table)} SET ${assignments}${where} RETURNING *`;
            const rows = await db(query);
            return Array.isArray(rows) ? rows as Row[] : [];
        }
        case "upsert": {
            const values = state.values && !Array.isArray(state.values) ? normalizeRow(state.values) : {};
            if (!Object.keys(values).length) return [];
            const conflictColumn = state.conflictColumn || "id";
            const columns = Object.keys(values).map(escapeIdentifier).join(", ");
            const placeholders = Object.entries(values).map(([key, value]) => escapeColumnValue(key, value)).join(", ");
            const assignments = Object.keys(values).map((key) => `${escapeIdentifier(key)} = EXCLUDED.${escapeIdentifier(key)}`).join(", ");
            const query = `INSERT INTO ${escapeIdentifier(table)} (${columns}) VALUES (${placeholders}) ON CONFLICT (${escapeIdentifier(conflictColumn)}) DO UPDATE SET ${assignments} RETURNING *`;
            const rows = await db(query);
            return Array.isArray(rows) ? rows as Row[] : [];
        }
        case "delete": {
            const where = compileWhere(state.filters);
            const query = `DELETE FROM ${escapeIdentifier(table)}${where} RETURNING *`;
            const rows = await db(query);
            return Array.isArray(rows) ? rows as Row[] : [];
        }
        default:
            return [];
    }
}

function runWithMemory(state: QueryState): Row[] {
    const table = ensureTable(state.table);
    const existing = memoryStore.get(table) || [];
    switch (state.op) {
        case "select": {
            let rows = [...existing];
            for (const filter of state.filters) {
                rows = rows.filter((row) => {
                    const value = row[filter.column];
                    if (filter.operator === "in") {
                        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
                        return values.includes(value as never);
                    }
                    return value === filter.value;
                });
            }
            if (state.orderBy) {
                rows = [...rows].sort((a, b) => {
                    const left = a[state.orderBy!.column];
                    const right = b[state.orderBy!.column];
                    if (left === right) return 0;
                    const leftValue = String(left ?? "");
                    const rightValue = String(right ?? "");
                    const result = leftValue > rightValue ? 1 : -1;
                    return state.orderBy!.ascending ? result : -result;
                });
            }
            if (state.limitN && state.limitN > 0) {
                rows = rows.slice(0, state.limitN);
            }
            return rows;
        }
        case "insert": {
            const inputs = Array.isArray(state.values) ? state.values : [state.values || {}];
            const records = inputs.map((input, index) => normalizeRow({ ...input, id: (input.id as string | undefined) || `mock-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}` }));
            const updated = [...existing, ...records];
            memoryStore.set(table, updated);
            return records;
        }
        case "update": {
            const next = existing.map((row) => {
                let match = true;
                for (const filter of state.filters) {
                    const value = row[filter.column];
                    if (filter.operator === "in") {
                        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
                        match = values.includes(value as never);
                    } else {
                        match = value === filter.value;
                    }
                    if (!match) break;
                }
                if (!match) return row;
                return { ...row, ...(state.values || {}) };
            });
            memoryStore.set(table, next);
            return next.filter((row) => {
                let match = true;
                for (const filter of state.filters) {
                    const value = row[filter.column];
                    if (filter.operator === "in") {
                        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
                        match = values.includes(value as never);
                    } else {
                        match = value === filter.value;
                    }
                    if (!match) break;
                }
                return match;
            });
        }
        case "upsert": {
            const conflictColumn = state.conflictColumn || "id";
            const values = state.values && !Array.isArray(state.values) ? state.values : {};
            const existingIndex = existing.findIndex((row) => row[conflictColumn] === values[conflictColumn]);
            if (existingIndex >= 0) {
                const updated = existing.map((row, index) => index === existingIndex ? { ...row, ...values } : row);
                memoryStore.set(table, updated);
                return [updated[existingIndex]];
            }
            return runWithMemory({ ...state, op: "insert", values });
        }
        case "delete": {
            const filtered = existing.filter((row) => {
                let match = true;
                for (const filter of state.filters) {
                    const value = row[filter.column];
                    if (filter.operator === "in") {
                        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
                        match = values.includes(value as never);
                    } else {
                        match = value === filter.value;
                    }
                    if (!match) break;
                }
                return !match;
            });
            memoryStore.set(table, filtered);
            return existing.filter((row) => {
                let match = true;
                for (const filter of state.filters) {
                    const value = row[filter.column];
                    if (filter.operator === "in") {
                        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
                        match = values.includes(value as never);
                    } else {
                        match = value === filter.value;
                    }
                    if (!match) break;
                }
                return match;
            });
        }
        default:
            return [];
    }
}

class QueryBuilder {
    private state: QueryState;

    constructor(private readonly client: CompatClient, table: string) {
        this.state = { table, op: "select", filters: [] };
    }

    then<TResult1 = { data: Row[] | Row | null; error: null }, TResult2 = never>(
        onfulfilled?: ((value: { data: Row[] | Row | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
        return this.executeResult().then(onfulfilled, onrejected);
    }

    catch<TResult = never>(onrejected?: (reason: unknown) => TResult | PromiseLike<TResult>) {
        return this.executeResult().catch(onrejected);
    }

    finally(onfinally?: (() => void) | null) {
        return this.executeResult().finally(onfinally);
    }

    select(columns = "*"): this {
        this.state.columns = columns;
        return this;
    }

    eq(column: string, value: unknown): this {
        this.state.filters.push({ column, operator: "eq", value });
        return this;
    }

    in(column: string, values: unknown[]): this {
        this.state.filters.push({ column, operator: "in", value: values });
        return this;
    }

    order(column: string, options?: { ascending?: boolean }): this {
        this.state.orderBy = { column, ascending: options?.ascending ?? true };
        return this;
    }

    limit(value: number): this {
        this.state.limitN = value;
        return this;
    }

    insert(values: RowInput | RowInput[]): this {
        this.state.op = "insert";
        this.state.values = values;
        return this;
    }

    update(values: RowInput): this {
        this.state.op = "update";
        this.state.values = values;
        return this;
    }

    upsert(values: RowInput, options?: { onConflict?: string }): this {
        this.state.op = "upsert";
        this.state.values = values;
        this.state.conflictColumn = options?.onConflict;
        return this;
    }

    async single(): Promise<{ data: Row | null; error: null }> {
        const rows = await this.execute();
        return { data: rows[0] ?? null, error: null };
    }

    async maybeSingle(): Promise<{ data: Row | null; error: null }> {
        const rows = await this.execute();
        return { data: rows[0] ?? null, error: null };
    }

    async execute(): Promise<Row[]> {
        const dbRows = await runWithDb(this.state);
        if (dbRows !== null) return dbRows;
        if (process.env.NODE_ENV === "test") return runWithMemory(this.state);
        throw new Error("DATABASE_URL is required; in-memory persistence is disabled outside tests");
    }

    async executeResult(): Promise<{ data: Row[] | Row | null; error: null }> {
        const rows = await this.execute();
        return { data: rows, error: null };
    }
}

export type CompatUser = { id?: string | null; name?: string | null; email?: string | null } | null;

export type CompatClient = {
    auth: {
        getUser: () => Promise<{ data: { user: CompatUser }; error: null }>;
        signInWithOtp: (options: { email: string; options?: { emailRedirectTo?: string } }) => Promise<{ data: { user: CompatUser }; error: null }>;
    };
    from: (table: string) => QueryBuilder;
};

export function createCompatClient(): CompatClient {
    return {
        auth: {
            getUser: async () => ({ data: { user: await getCurrentUser() }, error: null }),
            signInWithOtp: async () => ({ data: { user: null }, error: null }),
        },
        from: (table: string) => new QueryBuilder({} as CompatClient, table),
    };
}

export async function createClient(): Promise<CompatClient> {
    return createCompatClient();
}

export function createServiceClient(): CompatClient {
    if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
        throw new Error("DATABASE_URL is required for Neon persistence");
    }
    return createCompatClient();
}

export function createNeonQueryBuilder(table: string) {
    return new QueryBuilder(createCompatClient(), table);
}
