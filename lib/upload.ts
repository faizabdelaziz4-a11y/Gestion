import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export interface SavedFile {
  relPath: string; // ex. /uploads/xxxx.jpg
  base64: string;
  mediaType: string;
}

export async function saveImage(file: File): Promise<SavedFile> {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return {
    relPath: `/uploads/${name}`,
    base64: buf.toString("base64"),
    mediaType: file.type || "image/jpeg",
  };
}
