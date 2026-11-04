import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StorageAdapter } from './index.ts';

/** Node.js 시연용 영구 저장소. 모바일에서는 기기 저장소 어댑터로 교체합니다. */
export class FileStorage implements StorageAdapter {
  private directory: string;
  constructor(directory: string) { this.directory = resolve(directory); }
  private path(key: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('잘못된 저장 키입니다.');
    return join(this.directory, `${key}.json`);
  }
  async getItem(key: string): Promise<string | null> {
    try { return await readFile(this.path(key), 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  async setItem(key: string, value: string): Promise<void> {
    const target = this.path(key);
    await mkdir(this.directory, { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temporary, target);
    } finally { await rm(temporary, { force: true }); }
  }
}
