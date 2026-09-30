import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

export function formatCurrency(cents: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

export function formatCurrencyRange(low: number, high: number): string {
    if (low === 0 && high === 0) return "DIY / Free";
    if (low === 0) return `Up to ${formatCurrency(high)}`;
    return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}

export function generateSessionToken(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function generatePublicId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "GG-";
    for (let i = 0; i < 8; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

export function isValidZip(zip: string): boolean {
    return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function slaDueAt(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function statusBadgeColor(status: string): string {
    switch (status) {
        case "draft":
            return "bg-slate-100 text-slate-700";
        case "pending_payment":
            return "bg-amber-100 text-amber-800";
        case "paid":
            return "bg-blue-100 text-blue-800";
        case "in_review":
            return "bg-purple-100 text-purple-800";
        case "completed":
            return "bg-emerald-100 text-emerald-800";
        case "cancelled":
            return "bg-red-100 text-red-800";
        default:
            return "bg-slate-100 text-slate-700";
    }
}

export function severityColor(severity: string): string {
    switch (severity) {
        case "low":
            return "bg-emerald-100 text-emerald-800";
        case "medium":
            return "bg-amber-100 text-amber-800";
        case "high":
            return "bg-orange-100 text-orange-800";
        case "critical":
            return "bg-red-100 text-red-800";
        default:
            return "bg-slate-100 text-slate-700";
    }
}
