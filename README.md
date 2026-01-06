# File Storage Adapter

Framework-agnostic storage adapter library for sharing a single file management interface across projects. The goal is to keep one abstraction on top of different storage implementations so moving projects between clouds (or to local storage) is easy.

## Packages

- `@heilgar/file-storage-adapter-core` - interfaces and base adapter helpers.
- `@heilgar/file-storage-adapter-fs` - filesystem implementation.
- `@heilgar/file-storage-adapter-s3` - S3-compatible storage implementation (AWS S3, LocalStack).
- `@heilgar/file-storage-adapter-vercel-blob` - Vercel Blob storage implementation.

## Install

```sh
npm install @heilgar/file-storage-adapter-fs
```

## Usage

### Filesystem Adapter

```ts
import { FsAdapter } from '@heilgar/file-storage-adapter-fs';

const adapter = new FsAdapter({
  rootDir: '/tmp/storage',      // required: root directory for file storage
  basePath: 'uploads',           // optional: prefix for all keys
  baseUrl: 'https://files.example.com', // optional: base URL for getSignedUrl
});

const metadata = await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const list = await adapter.list({ prefix: 'images' });
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

**Config type:**
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
  bucket: 'my-bucket',           // required: S3 bucket name
  region: 'us-east-1',           // required: AWS region
  basePath: 'uploads',           // optional: prefix for all keys
  endpoint: 'http://localhost:4566', // optional: custom endpoint (e.g., LocalStack)
  credentials: {                 // optional: AWS credentials
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key',
  },
  forcePathStyle: true,          // optional: use path-style URLs (needed for LocalStack)
});

const metadata = await adapter.upload('documents/report.pdf', Buffer.from('...'));
const file = await adapter.download('documents/report.pdf');
const url = await adapter.getSignedUrl('documents/report.pdf', { expiresIn: 3600 });
```

**Config type:**
```ts
interface S3AdapterConfig {
  bucket: string;       // S3 bucket name
  region: string;       // AWS region
  basePath?: string;    // Optional prefix for all keys
  endpoint?: string;    // Optional custom endpoint (for LocalStack, MinIO, etc.)
  credentials?: {       // Optional AWS credentials
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean; // Optional: use path-style URLs
}
```

### Vercel Blob Adapter

```ts
import { VercelBlobAdapter } from '@heilgar/file-storage-adapter-vercel-blob';

const adapter = new VercelBlobAdapter({
  token: process.env.BLOB_READ_WRITE_TOKEN, // required: Vercel Blob token
  basePath: 'uploads',                       // optional: prefix for all keys
});

const metadata = await adapter.upload('avatars/user.jpg', Buffer.from('...'));
const file = await adapter.download('avatars/user.jpg');
const url = await adapter.getSignedUrl('avatars/user.jpg', { expiresIn: 3600 });
```

**Config type:**
```ts
interface VercelBlobAdapterConfig {
  token: string;      // Vercel Blob read/write token
  basePath?: string;  // Optional prefix for all keys
}
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

