import type { FileStorageAdapter } from '@heilgar/file-storage-adapter-core';
import { FsAdapter } from '@heilgar/file-storage-adapter-fs';
import { VercelBlobAdapter } from '@heilgar/file-storage-adapter-vercel-blob';
import { join } from 'node:path';

export type AdapterName = 'fs' | 'vercel-blob';

export function getAdapterName(value: string | null): AdapterName {
  if (value === 'fs' || value === 'vercel-blob') {
    return value;
  }
  throw new Error(`Unknown adapter: ${value ?? 'null'}`);
}

export function createAdapter(name: AdapterName): FileStorageAdapter {
  const basePath = process.env.STORAGE_BASE_PATH;

  if (name === 'fs') {
    const rootDir = process.env.FS_ROOT_DIR ?? join(process.cwd(), 'storage');
    return new FsAdapter({
      rootDir,
      baseUrl: process.env.FS_BASE_URL,
      basePath,
    });
  }

  const token = process.env.VERCEL_BLOB_TOKEN;
  if (!token) {
    throw new Error('VERCEL_BLOB_TOKEN is not configured');
  }

  return new VercelBlobAdapter({ token, basePath });
}
