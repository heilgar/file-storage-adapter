# File Storage Adapter

Simple storage adapter library for sharing a single file management interface across projects. The goal is to keep one abstraction on top of different storage implementations so moving projects between clouds (or to local storage) is easy.

## Packages

- `@heilgar/file-storage-adapter-core` - interfaces and base adapter helpers.
- `@heilgar/file-storage-adapter-fs` - filesystem implementation.

## Install

```sh
npm install @heilgar/file-storage-adapter-core @heilgar/file-storage-adapter-fs
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

## Notes

- `basePath` (optional) prefixes keys.
- `baseUrl` (optional, fs adapter) enables `getSignedUrl` as a public URL.
