# File Storage Adapter Vercel Blob

Vercel Blob implementation of the file storage adapter.

## Install

```sh
npm install @heilgar/file-storage-adapter-vercel-blob
```

## Usage

### Public store (default)

```ts
import { VercelBlobAdapter } from '@heilgar/file-storage-adapter-vercel-blob';

const adapter = new VercelBlobAdapter({
  token: process.env.BLOB_READ_WRITE_TOKEN, // required
  basePath: 'uploads',                       // optional: prefix for all keys
});

await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

### Private store

Requires a private Blob store ([create one with `vercel blob create-store name --access private`](https://vercel.com/docs/vercel-blob/private-storage)) and `@vercel/blob` >= 2.4.0 for signed URLs.

```ts
const adapter = new VercelBlobAdapter({
  token: process.env.BLOB_READ_WRITE_TOKEN,
  access: 'private',
});

await adapter.upload('docs/contract.pdf', buffer, { contentType: 'application/pdf' });

// Reads through @vercel/blob `get()` with auth.
const file = await adapter.download('docs/contract.pdf');

// Time-limited signed URL via issueSignedToken + presignUrl.
const url = await adapter.getSignedUrl('docs/contract.pdf', { expiresIn: 600 });

// Signed PUT URL for direct browser uploads (private only).
const { url: putUrl, headers } = await adapter.getSignedUrlUpload('docs/contract.pdf', {
  expiresIn: 600,
  contentType: 'application/pdf',
});
```

## Configuration

```ts
interface VercelBlobAdapterConfig {
  token: string;                     // Vercel Blob read/write token
  access?: 'public' | 'private';     // default: 'public'. Must match the store's access mode.
  basePath?: string;                 // optional key prefix
}
```

## Bulk delete

```ts
// Remove everything under a folder-like prefix.
const { deleted } = await adapter.deleteByPrefix('exports/');

// Bound how much each list() page returns and how many keys total to delete.
await adapter.deleteByPrefix('exports/', { batch: 50, limit: 500 });
```

The method paginates through `list()` with `hasMore`/`cursor` and is safe to retry —
`@vercel/blob`'s underlying `del()` no-ops on already-deleted keys.

## Notes

- `access` must match the Blob store's access mode in Vercel — mixing modes will fail at the API.
- Public stores: `getSignedUrl()` returns the underlying public blob URL; `getSignedUrlUpload()` throws (use `upload()` directly).
- Private stores: `getSignedUrl()` and `getSignedUrlUpload()` produce HMAC-signed URLs with `validUntil = now + expiresIn s`.
- Range downloads are not supported.

## Breaking changes in 2.0.0

- `FileMetadata` now includes a required `key` field. `list()` results expose
  `key` with `basePath` stripped, so the same value round-trips with `upload()`,
  `delete()`, and `download()`. Consumers reading only `name` keep working;
  typed code constructing/asserting on `FileMetadata` needs `key`.
- New `deleteByPrefix(prefix, opts?)` method on the adapter — see above.
