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
  token: process.env.BLOB_READ_WRITE_TOKEN,
  basePath: 'uploads',
});

const metadata = await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const list = await adapter.list({ prefix: 'images' });
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

## Notes

- `token` (required) is your Vercel Blob read/write token.
- `basePath` (optional) prefixes keys.
- All files are uploaded with `public` access (private is not available).
- Range downloads are not supported.
- Signed upload URLs are not supported - use `upload()` method directly.
