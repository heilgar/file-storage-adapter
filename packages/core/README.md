# File Storage Adapter Core

Interfaces and base adapter helpers for storage providers.

## Install

```sh
npm install @heilgar/file-storage-adapter-core
```

## Usage

```ts
import type { FileStorageAdapter, FileStorageAdapterConfig } from '@heilgar/file-storage-adapter-core';
import { BaseAdapter } from '@heilgar/file-storage-adapter-core';
```

## Configuration

**Base config type:**
```ts
interface FileStorageAdapterConfig {
  basePath?: string;  // Optional prefix for all keys
}
```

All adapter implementations extend this base configuration.

## API

The core package exports the `FileStorageAdapter` interface and `BaseAdapter`
helper. Implementations should provide:

- `upload`, `download`, `getMetadata`, `delete`, `exists`, `list`
- `getSignedUrl`, `getSignedUrlUpload`
- `copy`, `move`

### FileStorageAdapter Interface

```ts
interface FileStorageAdapter {
  upload(key: string, file: Buffer | NodeJS.ReadableStream | File, options?: UploadOptions): Promise<FileMetadata>;
  download(key: string, options?: DownloadOptions): Promise<FileObject>;
  getMetadata(key: string): Promise<FileMetadata | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  list(options?: ListOptions): Promise<ListResult>;
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  getSignedUrlUpload(key: string, options: SignedUrlOptions): Promise<SignedUrlUploadResult>;
  copy(sourceKey: string, destinationKey: string): Promise<FileMetadata>;
  move(sourceKey: string, destinationKey: string): Promise<FileMetadata>;
}
```
