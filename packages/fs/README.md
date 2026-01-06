# File Storage Adapter FS

Filesystem implementation of the file storage adapter.

## Install

```sh
npm install @heilgar/file-storage-adapter-fs
```

## Usage

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

## Configuration

**Config type:**
```ts
interface FsAdapterConfig {
  rootDir: string;    // Root directory for file storage
  basePath?: string;  // Optional prefix for all keys
  baseUrl?: string;   // Optional base URL for public access (required for getSignedUrl)
}
```

## Notes

- Files are stored in the local filesystem at `rootDir`
- Metadata is stored alongside files in `.meta.json` files
- `basePath` (optional) prefixes all keys
- `baseUrl` (optional) enables `getSignedUrl` as a public URL
- Signed upload URLs are not supported
