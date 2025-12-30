# File Storage Adapter Core

Interfaces and base adapter helpers for storage providers.

## Install

```sh
npm install @heilgar/file-storage-adapter-core
```

## Usage

```ts
import type { FileStorageAdapter } from '@heilgar/file-storage-adapter-core';
```

## API

The core package exports the `FileStorageAdapter` interface and `BaseAdapter`
helper. Implementations should provide:

- `upload`, `download`, `getMetadata`, `delete`, `exists`, `list`
- `getSignedUrl`, `getSignedUrlUpload`
- `copy`, `move`
