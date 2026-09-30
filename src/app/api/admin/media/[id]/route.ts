import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { readStoredObject } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const rows = await db`SELECT storage_key, content_type, file_name FROM assessment_media WHERE id = ${id} LIMIT 1`;
  const media = rows[0];
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bytes = await readStoredObject(String(media.storage_key));
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": String(media.content_type || "application/octet-stream"),
      "Content-Disposition": `inline; filename="${String(media.file_name || "evidence").replace(/["\r\n]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
