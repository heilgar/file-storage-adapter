# File Storage Adapter

[![npm (s3)](https://img.shields.io/npm/v/@heilgar/file-storage-adapter-s3?label=%40heilgar%2Ffile-storage-adapter-s3)](https://www.npmjs.com/package/@heilgar/file-storage-adapter-s3)
[![downloads](https://img.shields.io/npm/dm/@heilgar/file-storage-adapter-s3?label=downloads)](https://www.npmjs.com/package/@heilgar/file-storage-adapter-s3)
[![types](https://img.shields.io/npm/types/@heilgar/file-storage-adapter-s3)](https://www.npmjs.com/package/@heilgar/file-storage-adapter-s3)
[![license](https://img.shields.io/github/license/heilgar/file-storage-adapter)](LICENCE)
[![Test](https://github.com/heilgar/file-storage-adapter/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/heilgar/file-storage-adapter/actions/workflows/test.yml)
[![Latest Release](https://github.com/heilgar/file-storage-adapter/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/heilgar/file-storage-adapter/actions/workflows/npm-publish.yml)

A framework-agnostic file storage library for **Node.js** and **TypeScript**. Use one adapter API across **AWS S3**, **Vercel Blob**, and the **local filesystem** (with **LocalStack** and **MinIO** for tests). Swap backends by changing config — your application code stays the same.

## TL;DR

```ts
import { S3Adapter } from '@heilgar/file-storage-adapter-s3';

const storage = new S3Adapter({ bucket: 'my-bucket', region: 'us-east-1' });

await storage.upload('avatars/user-42.jpg', buffer, { contentType: 'image/jpeg' });
const url = await storage.getSignedUrl('avatars/user-42.jpg', { expiresIn: 3600 });
```

The same code runs against the local filesystem (`FsAdapter`) or Vercel Blob (`VercelBlobAdapter`) — change the import and the constructor; keep everything else.

## Why this library?

- **One API, many backends.** Local files in dev, S3 in prod, Vercel Blob on Vercel — no per-backend branches in app code.
- **Typed end-to-end.** Full TypeScript types on every adapter, option, and result.
- **Streaming + signed URLs.** Range downloads on S3, presigned upload/download URLs where the backend supports them.
- **Small surface.** Eleven methods total: `upload`, `download`, `getMetadata`, `delete`, `exists`, `list`, `copy`, `move`, `getSignedUrl`, `getSignedUrlUpload`, `deleteByPrefix`.
- **No vendor lock-in.** Switching providers is a config change, not a rewrite.

## When to use it / when not to

**Use it when:**
- You want the same code to read/write files locally during development and on S3 (or Vercel Blob) in production.
- You're shipping a Node.js / TypeScript app and don't want to wrap the AWS SDK yourself.
- You want presigned URLs, listing, and pagination without re-implementing them per backend.

**Skip it when:**
- You need backend-specific features (S3 Object Lock, Vercel Blob analytics events, etc.) — use the native SDK.
- You need a browser-side library — this targets Node.js.
- You're already happy with `multer` for one specific stack and don't need portability.

## Packages

| Package | Backend | Built on |
| --- | --- | --- |
| [`@heilgar/file-storage-adapter-core`](packages/core) | — | — |
| [`@heilgar/file-storage-adapter-fs`](packages/fs) | Local filesystem | `node:fs` |
| [`@heilgar/file-storage-adapter-s3`](packages/s3) | AWS S3, LocalStack, MinIO | `@aws-sdk/client-s3` |
| [`@heilgar/file-storage-adapter-vercel-blob`](packages/vercel-blob) | Vercel Blob (public + private) | `@vercel/blob` |

## Install

```sh
# pick the backends you need — types come transitively from -core
npm install @heilgar/file-storage-adapter-fs
npm install @heilgar/file-storage-adapter-s3
npm install @heilgar/file-storage-adapter-vercel-blob
```

## Usage

### Filesystem Adapter

```ts
import { FsAdapter } from '@heilgar/file-storage-adapter-fs';

const adapter = new FsAdapter({
  rootDir: '/tmp/storage',              // required: root directory for file storage
  basePath: 'uploads',                  // optional: prefix for all keys
  baseUrl: 'https://files.example.com', // optional: base URL for getSignedUrl
});

const metadata = await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const list = await adapter.list({ prefix: 'images' });
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

```ts
interface FsAdapterConfig {
  rootDir: string;    // Root directory for file storage
  basePath?: string;  // Optional prefix for all keys
  baseUrl?: string;   // Optional base URL for public access (required for getSignedUrl)
}
```

### S3 Adapter

```ts
import { S3Adapter } from '@heilgar/file-storage-adapter-s3';

const adapter = new S3Adapter({
  bucket: 'my-bucket',
  region: 'us-east-1',
  basePath: 'uploads',                  // optional: prefix for all keys
  endpoint: 'http://localhost:4566',    // optional: LocalStack / MinIO
  credentials: {                        // optional: AWS credentials
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key',
  },
  forcePathStyle: true,                 // optional: needed for LocalStack/MinIO
});

const metadata = await adapter.upload('documents/report.pdf', Buffer.from('...'));
const file = await adapter.download('documents/report.pdf');
const url = await adapter.getSignedUrl('documents/report.pdf', { expiresIn: 3600 });
```

```ts
interface S3AdapterConfig {
  bucket: string;
  region: string;
  basePath?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean;
}
```

### Vercel Blob Adapter

```ts
import { VercelBlobAdapter } from '@heilgar/file-storage-adapter-vercel-blob';

const adapter = new VercelBlobAdapter({
  token: process.env.BLOB_READ_WRITE_TOKEN, // required
  access: 'public',                          // optional: 'public' (default) | 'private'
  basePath: 'uploads',                       // optional: prefix for all keys
});

const metadata = await adapter.upload('avatars/user.jpg', Buffer.from('...'));
const file = await adapter.download('avatars/user.jpg');
const url = await adapter.getSignedUrl('avatars/user.jpg', { expiresIn: 3600 });
```

```ts
interface VercelBlobAdapterConfig {
  token: string;
  access?: 'public' | 'private';
  basePath?: string;
}
```

## API

The core package exports the `FileStorageAdapter` interface and the `BaseAdapter` helper. Implementations provide:

- `upload`, `download`, `getMetadata`, `delete`, `exists`, `list`
- `getSignedUrl`, `getSignedUrlUpload`
- `copy`, `move`, `deleteByPrefix`

See [`packages/core/README.md`](packages/core/README.md) for full type signatures.

## FAQ

**How do I switch from S3 to local files for tests?**
Swap `new S3Adapter({...})` for `new FsAdapter({ rootDir: '/tmp/test' })`. Same methods, same shapes — your test code does not change.

**Does it stream?**
`upload` accepts `Buffer | NodeJS.ReadableStream | File`. `download` returns the bytes plus metadata; use `options.range` for byte ranges on S3.

**How do I generate a presigned upload URL?**
`adapter.getSignedUrlUpload(key, { expiresIn, contentType })`. Supported on S3 and on private Vercel Blob stores.

**Does it work with MinIO?**
Yes — use the S3 adapter with a custom `endpoint` and `forcePathStyle: true`.

**Does it work with LocalStack?**
Yes — same approach as MinIO. See the [LocalStack](#localstack) section below.

**Does it support Vercel Blob private stores?**
Yes — pass `access: 'private'` to `VercelBlobAdapter`. Requires `@vercel/blob >= 2.4.0`.

**Why not just call the AWS SDK directly?**
You should, if you only ever deploy to S3. This library exists for apps that need to run locally without S3 and ship to production on a different backend without code changes.

## Migration recipes

### From direct `aws-sdk` usage

```ts
// before
const s3 = new S3Client({ region });
await s3.send(new PutObjectCommand({ Bucket, Key, Body: buffer }));

// after
const storage = new S3Adapter({ bucket: Bucket, region });
await storage.upload(Key, buffer);
```

### From `fs/promises` for uploads

```ts
// before
import fs from 'node:fs/promises';
await fs.writeFile(path.join('/var/uploads', key), buffer);

// after
import { FsAdapter } from '@heilgar/file-storage-adapter-fs';
const storage = new FsAdapter({ rootDir: '/var/uploads' });
await storage.upload(key, buffer);
// Switching to S3 in prod is now a one-line config change.
```

## Development

```sh
npm install
npm run build
npm test
```

### LocalStack

LocalStack is used to test the S3 adapter without an AWS account.

```sh
docker compose up -d
```

```sh
set -a; source .env.dev; set +a
aws --endpoint-url=http://localhost:4566 s3 ls
```

- LocalStack auto-creates `local-storage-bucket` on startup
- Test credentials live in `.env.dev` (`dev` / `dev`)
- S3 endpoint: `http://localhost:4566`

## Resources

- LLM context: [`llms.md`](llms.md) (full) · [`llms.txt`](llms.txt) (directory)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- License: [MIT](LICENCE)

## License

MIT © [heilgar](https://github.com/heilgar)
