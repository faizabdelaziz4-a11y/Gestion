import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_BUCKET || "uploads";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export interface SavedFile {
  relPath: string; // URL publique (Supabase) ou /uploads/... (local)
  base64: string;
  mediaType: string;
}

let supabase: ReturnType<typeof createClient> | null = null;
function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!supabase) supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

export async function saveImage(file: File): Promise<SavedFile> {
  const buf = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "image/jpeg";
  const ext = (mediaType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const base64 = buf.toString("base64");

  const sb = client();
  if (sb) {
    // Stockage Supabase (persistant, adapté au serverless / Netlify).
    await sb.storage
      .from(BUCKET)
      .upload(name, buf, { contentType: mediaType, upsert: true });
    const { data } = sb.storage.from(BUCKET).getPublicUrl(name);
    return { relPath: data.publicUrl, base64, mediaType };
  }

  // Repli : disque local (développement uniquement).
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return { relPath: `/uploads/${name}`, base64, mediaType };
}
