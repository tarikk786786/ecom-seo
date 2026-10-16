import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductRecord } from "./types";

export type LocalStoreFile = {
  version: 1;
  updatedAt: string;
  products: ProductRecord[];
};

function storePath(): string {
  // apps/web-dashboard → repo root → data/
  return path.resolve(process.cwd(), "../..", "data", "products-store.json");
}

export async function readLocalStore(): Promise<LocalStoreFile> {
  const file = storePath();
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as LocalStoreFile;
    if (parsed?.version !== 1 || !Array.isArray(parsed.products)) {
      return { version: 1, updatedAt: new Date().toISOString(), products: [] };
    }
    return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { version: 1, updatedAt: new Date().toISOString(), products: [] };
    throw err;
  }
}

export async function writeLocalStore(products: ProductRecord[]): Promise<void> {
  const file = storePath();
  await mkdir(path.dirname(file), { recursive: true });
  const payload: LocalStoreFile = { version: 1, updatedAt: new Date().toISOString(), products };
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await rename(tmp, file);
}

export function localStorePathForTests(absolutePath: string): string {
  return absolutePath;
}
