# File Storage Adapter

Framework-agnostic storage adapter library for sharing a single file management interface across projects. The goal is to keep one abstraction on top of different storage implementations so moving projects between clouds (or to local storage) is easy.

## Packages

- `@heilgar/file-storage-adapter-core` - interfaces and base adapter helpers.
- `@heilgar/file-storage-adapter-fs` - filesystem implementation.
- `@heilgar/file-storage-adapter-vercel-blob` - Vercel Blob storage implementation.

## Install

```sh
npm install @heilgar/file-storage-adapter-fs
```

## Usage

```ts
import { FsAdapter } from '@heilgar/file-storage-adapter-fs';

const adapter = new FsAdapter({
  rootDir: '/tmp/storage',
  basePath: 'uploads',
  baseUrl: 'https://files.example.com',
});

const metadata = await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const list = await adapter.list({ prefix: 'images' });
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

## API

The core package exports the `FileStorageAdapter` interface and `BaseAdapter` helper. Implementations should provide:

- `upload`, `download`, `getMetadata`, `delete`, `exists`, `list`
- `getSignedUrl`, `getSignedUrlUpload`
- `copy`, `move`

## Development

```sh
npm run build
npm test
```

### LocalStack

LocalStack is used for local development and testing of cloud services (S3) without incurring costs or requiring internet connectivity.

**Start LocalStack:**

```sh
docker compose up -d
```

**List S3 buckets:**

```sh
set -a; source .env.dev; set +a
aws --endpoint-url=http://localhost:4566 s3 ls
```

**Configuration:**
- LocalStack automatically creates the `local-storage-bucket` on startup
- AWS credentials are in `.env.dev` (access key: `dev`, secret key: `dev`)
- S3 endpoint: `http://localhost:4566`

## Notes

- `basePath` (optional) prefixes keys.
- `baseUrl` (optional, fs adapter) enables `getSignedUrl` as a public URL.

