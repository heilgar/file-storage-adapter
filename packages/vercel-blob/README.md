# File Storage Adapter Vercel Blob

Vercel Blob implementation of the file storage adapter.

## Install

```sh
npm install @heilgar/file-storage-adapter-vercel-blob
```

## Usage

```ts
import { VercelBlobAdapter } from '@heilgar/file-storage-adapter-vercel-blob';

const adapter = new VercelBlobAdapter({
  token: process.env.BLOB_READ_WRITE_TOKEN, // required: Vercel Blob token
  basePath: 'uploads',                       // optional: prefix for all keys
});

const metadata = await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const list = await adapter.list({ prefix: 'images' });
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

## Configuration

**Config type:**
```ts
interface VercelBlobAdapterConfig {
  token: string;      // Vercel Blob read/write token
  basePath?: string;  // Optional prefix for all keys
}
```

## Notes

- `token` (required) is your Vercel Blob read/write token
- `basePath` (optional) prefixes all keys
- All files are uploaded with `public` access (private is not available)
- Range downloads are not supported
- Signed upload URLs are not supported - use `upload()` method directly
