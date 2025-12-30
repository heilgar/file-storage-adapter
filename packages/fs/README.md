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
  rootDir: '/tmp/storage',
  basePath: 'uploads',
  baseUrl: 'https://files.example.com',
});

const metadata = await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const list = await adapter.list({ prefix: 'images' });
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

## Notes

- `basePath` (optional) prefixes keys.
- `baseUrl` (optional) enables `getSignedUrl` as a public URL.
