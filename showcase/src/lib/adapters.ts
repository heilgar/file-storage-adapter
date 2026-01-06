import type { FileStorageAdapter } from '@heilgar/file-storage-adapter-core';
import { FsAdapter } from '@heilgar/file-storage-adapter-fs';
import { S3Adapter } from '@heilgar/file-storage-adapter-s3';
import { VercelBlobAdapter } from '@heilgar/file-storage-adapter-vercel-blob';
import { join } from 'node:path';

export type AdapterName = 'fs' | 's3' | 'vercel-blob';

export function getAdapterName(value: string | null): AdapterName {
  if (value === 'fs' || value === 's3' || value === 'vercel-blob') {
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

  if (name === 's3') {
    const region = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION;
    const bucket = process.env.AWS_S3_BUCKET ?? 'local-storage-bucket';
    const endpoint = process.env.EDGE_PORT ? `http://localhost:${process.env.EDGE_PORT}` : undefined;
    if (!region) {
      throw new Error('AWS_DEFAULT_REGION/AWS_REGION must be configured for S3 adapter');
    }
    return new S3Adapter({
      region,
      bucket,
      basePath,
      endpoint,
      forcePathStyle: !!endpoint,
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }

  const token = process.env.VERCEL_BLOB_TOKEN;
  if (!token) {
    throw new Error('VERCEL_BLOB_TOKEN is not configured');
  }

  return new VercelBlobAdapter({ token, basePath });
}
