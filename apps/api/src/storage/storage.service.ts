import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local filesystem document store for MVP.
 * S3/MinIO can replace this behind the same interface.
 */
@Injectable()
export class StorageService {
  private root = process.env.DOCUMENT_ROOT || path.join(process.cwd(), "../../storage/documents");

  async put(organizationId: string, filename: string, data: Buffer) {
    const dir = path.join(this.root, organizationId);
    await mkdir(dir, { recursive: true });
    const key = `${organizationId}/${Date.now()}-${filename}`;
    const full = path.join(this.root, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    const hash = createHash("sha256").update(data).digest("hex");
    return { key, hash };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(path.join(this.root, key));
  }
}
