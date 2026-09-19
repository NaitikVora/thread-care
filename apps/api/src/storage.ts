import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "./repository";
export interface ImageStorage {
  put(data: string): Promise<{ key: string; mime: string }>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export function decodeImage(data: unknown) {
  if (typeof data !== "string" || data.length > 5600000)
    throw new HttpError(400, "Use a JPG, PNG, or WebP image under 4 MB.");
  const match = data.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/,
  );
  if (!match) throw new HttpError(400, "The image format is not supported.");
  const bytes = Buffer.from(match[2], "base64");
  const mime = match[1];
  const valid =
    mime === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid || bytes.length > 4 * 1024 * 1024)
    throw new HttpError(400, "This file is not a valid supported image.");
  return { mime, bytes };
}
export class LocalImageStorage implements ImageStorage {
  constructor(private root: string) {}
  private location(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key");
    return path.join(this.root, key);
  }
  async put(data: string) {
    const { mime, bytes } = decodeImage(data),
      key = randomUUID();
    await mkdir(this.root, { recursive: true });
    await writeFile(this.location(key), bytes, { mode: 0o600 });
    return { key, mime };
  }
  async read(key: string) {
    return readFile(this.location(key));
  }
  async remove(key: string) {
    await unlink(this.location(key)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
