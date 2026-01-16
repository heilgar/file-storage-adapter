# File Storage Adapter - LLM Context Documentation

## Project Overview

**Repository:** heilgar/file-storage-adapter  
**Description:** Framework-agnostic storage adapter library for unified file management across different storage backends  
**License:** MIT  
**Author:** Oleh Hrebeniuk  
**Language:** TypeScript  
**Node Version:** 24.12.0  
**Package Manager:** npm 11.7.0

### Purpose

This library provides a single, consistent abstraction layer for file storage operations that works across multiple storage backends (filesystem, AWS S3, Vercel Blob). The goal is to make it easy to switch between different storage providers without changing application code.

### Key Features

- **Unified Interface:** Single API for all storage operations regardless of backend
- **Multiple Adapters:** Filesystem, S3-compatible storage, and Vercel Blob implementations
- **Framework Agnostic:** Works with any Node.js framework or standalone applications
- **TypeScript Support:** Full type definitions for all interfaces and adapters
- **Production Ready:** Comprehensive test coverage and battle-tested implementations

## Project Structure

This is a monorepo managed with npm workspaces containing multiple packages:

```
file-storage-adapter/
├── packages/
│   ├── core/              # Core interfaces and base adapter
│   ├── fs/                # Filesystem implementation
│   ├── s3/                # S3-compatible storage implementation
│   └── vercel-blob/       # Vercel Blob storage implementation
├── showcase/              # Example applications and demos
├── docker/                # Docker configuration for LocalStack
├── README.md              # Main documentation
├── CONTRIBUTING.md        # Contribution guidelines
├── package.json           # Root package configuration
└── vitest.config.js       # Test configuration
```

## Architecture

### Design Pattern

The library follows the **Adapter Pattern** to provide a consistent interface across different storage backends. Each adapter implements the `FileStorageAdapter` interface defined in the core package.

### Package Architecture

#### 1. Core Package (`@heilgar/file-storage-adapter-core`)

**Purpose:** Defines the common interface and base utilities for all adapters

**Key Exports:**
- `FileStorageAdapter` - Main interface that all adapters must implement
- `BaseAdapter` - Abstract base class with common functionality
- Type definitions for metadata, options, and results

**Main Types:**

```typescript
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

interface FileMetadata {
  name: string;
  mimeType: string;
  sizeInBytes: number;
  uploadedAt: Date;
  customMetadata?: Record<string, unknown>;
}

interface FileObject extends FileMetadata {
  content: Buffer;
}
```

#### 2. Filesystem Adapter (`@heilgar/file-storage-adapter-fs`)

**Purpose:** Local filesystem storage implementation

**Configuration:**
```typescript
interface FsAdapterConfig {
  rootDir: string;      // Root directory for file storage (required)
  basePath?: string;    // Optional prefix for all keys
  baseUrl?: string;     // Optional base URL for public access
}
```

**Use Cases:**
- Development environments
- Local file management
- Applications with filesystem-based storage requirements
- Testing without cloud dependencies

#### 3. S3 Adapter (`@heilgar/file-storage-adapter-s3`)

**Purpose:** AWS S3 and S3-compatible storage implementation

**Configuration:**
```typescript
interface S3AdapterConfig {
  bucket: string;       // S3 bucket name (required)
  region: string;       // AWS region (required)
  basePath?: string;    // Optional prefix for all keys
  endpoint?: string;    // Optional custom endpoint (for LocalStack, MinIO)
  credentials?: {       // Optional AWS credentials
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean; // Use path-style URLs (needed for LocalStack)
}
```

**Use Cases:**
- Production cloud storage
- AWS S3 integration
- LocalStack for local development
- MinIO or other S3-compatible services

#### 4. Vercel Blob Adapter (`@heilgar/file-storage-adapter-vercel-blob`)

**Purpose:** Vercel Blob storage implementation

**Configuration:**
```typescript
interface VercelBlobAdapterConfig {
  token: string;        // Vercel Blob read/write token (required)
  basePath?: string;    // Optional prefix for all keys
}
```

**Use Cases:**
- Vercel deployments
- Serverless applications on Vercel
- Edge-optimized file storage

## API Reference

### Core Operations

#### Upload
```typescript
const metadata = await adapter.upload('path/to/file.jpg', buffer, {
  contentType: 'image/jpeg',
  cacheControl: 'public, max-age=31536000',
  metadata: { userId: '123' },
  isPubliclyAccessible: true
});
```

**Parameters:**
- `key`: Unique file identifier/path
- `file`: Buffer, ReadableStream, or File object
- `options`: Optional upload configuration

**Returns:** `FileMetadata` with name, mimeType, sizeInBytes, uploadedAt, and customMetadata

#### Download
```typescript
const fileObject = await adapter.download('path/to/file.jpg', {
  range: { startByte: 0, endByte: 1024 }
});
```

**Parameters:**
- `key`: File identifier
- `options`: Optional download configuration (e.g., byte range)

**Returns:** `FileObject` with metadata and content Buffer

#### List
```typescript
const result = await adapter.list({
  prefix: 'images/',
  limit: 100,
  cursor: 'optional-pagination-token'
});
```

**Parameters:**
- `options`: Optional list configuration

**Returns:** `ListResult` with files array, nextCursor, and hasMore flag

#### Delete
```typescript
const deleted = await adapter.delete('path/to/file.jpg');
```

**Returns:** `boolean` indicating success

#### Exists
```typescript
const exists = await adapter.exists('path/to/file.jpg');
```

**Returns:** `boolean` indicating if file exists

#### Get Metadata
```typescript
const metadata = await adapter.getMetadata('path/to/file.jpg');
```

**Returns:** `FileMetadata | null`

#### Get Signed URL (Download)
```typescript
const url = await adapter.getSignedUrl('path/to/file.jpg', {
  expiresIn: 3600,  // seconds
  contentType: 'image/jpeg'
});
```

**Returns:** `string` - Temporary URL for accessing the file

#### Get Signed URL (Upload)
```typescript
const result = await adapter.getSignedUrlUpload('path/to/file.jpg', {
  expiresIn: 3600,
  contentType: 'image/jpeg'
});
```

**Returns:** `SignedUrlUploadResult` with url and optional headers

#### Copy
```typescript
const metadata = await adapter.copy('source/file.jpg', 'destination/file.jpg');
```

**Returns:** `FileMetadata` of the copied file

#### Move
```typescript
const metadata = await adapter.move('source/file.jpg', 'destination/file.jpg');
```

**Returns:** `FileMetadata` of the moved file

## Development Guide

### Prerequisites

- Node.js 24.12.0 (managed via Volta)
- npm 11.7.0
- Docker (for LocalStack S3 testing)

### Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run fmt

# Run biome checks
npm run check
```

### Project Scripts

- `npm run build` - Build all workspace packages
- `npm test` - Run all tests across workspaces
- `npm run lint` - Lint code with Biome
- `npm run fmt` - Format code with Biome
- `npm run check` - Run Biome checks and auto-fix
- `npm run check:unsafe` - Run Biome checks with unsafe auto-fixes
- `npm run clean` - Remove build artifacts

### LocalStack Development

LocalStack provides local AWS service emulation for S3 testing:

```bash
# Start LocalStack
docker compose up -d

# Check S3 buckets
set -a; source .env.dev; set +a
aws --endpoint-url=http://localhost:4566 s3 ls
```

**Configuration:**
- LocalStack endpoint: `http://localhost:4566`
- Test credentials: accessKeyId: `dev`, secretAccessKey: `dev`
- Auto-created bucket: `local-storage-bucket`
- Configuration file: `.env.dev`

### Testing

The project uses Vitest for testing. Each package has its own test suite:

```bash
# Run all tests
npm test

# Run tests for a specific package
npm test --workspace=packages/core
npm test --workspace=packages/fs
npm test --workspace=packages/s3
npm test --workspace=packages/vercel-blob
```

**Test Coverage:**
- Unit tests for all core functionality
- Integration tests for each adapter
- Mock implementations for external services
- LocalStack for S3 integration tests

## Common Patterns and Best Practices

### 1. Adapter Selection

Choose the appropriate adapter based on your deployment environment:

```typescript
// Development - Filesystem
const adapter = new FsAdapter({
  rootDir: '/tmp/storage',
  basePath: 'uploads'
});

// Production - S3
const adapter = new S3Adapter({
  bucket: process.env.S3_BUCKET,
  region: process.env.AWS_REGION,
  basePath: 'uploads'
});

// Vercel Deployment
const adapter = new VercelBlobAdapter({
  token: process.env.BLOB_READ_WRITE_TOKEN,
  basePath: 'uploads'
});
```

### 2. Base Path Usage

Use `basePath` to namespace files within the same storage:

```typescript
const userUploadsAdapter = new FsAdapter({
  rootDir: '/storage',
  basePath: 'user-uploads'  // Files will be stored at /storage/user-uploads/*
});

const systemFilesAdapter = new FsAdapter({
  rootDir: '/storage',
  basePath: 'system-files'  // Files will be stored at /storage/system-files/*
});
```

### 3. Error Handling

All methods return Promises and may throw errors. Always use try-catch:

```typescript
try {
  const metadata = await adapter.upload('file.jpg', buffer);
  console.log('Upload successful:', metadata);
} catch (error) {
  console.error('Upload failed:', error);
}
```

### 4. Pagination

Use the cursor-based pagination for listing files:

```typescript
let cursor: string | undefined;
let allFiles: FileMetadata[] = [];

do {
  const result = await adapter.list({
    prefix: 'images/',
    limit: 100,
    cursor
  });
  
  allFiles = allFiles.concat(result.files);
  cursor = result.nextCursor;
} while (result.hasMore);
```

### 5. Signed URLs

Generate temporary URLs for secure file access:

```typescript
// For downloads
const downloadUrl = await adapter.getSignedUrl('private/document.pdf', {
  expiresIn: 3600  // 1 hour
});

// For direct uploads from client
const { url, headers } = await adapter.getSignedUrlUpload('upload/file.jpg', {
  expiresIn: 300,  // 5 minutes
  contentType: 'image/jpeg'
});
```

## Code Style and Conventions

### Code Quality Tools

- **Biome:** Used for linting and formatting
- **TypeScript:** Strict mode enabled
- **Vitest:** Testing framework

### Naming Conventions

- **Packages:** kebab-case (e.g., `file-storage-adapter-fs`)
- **Classes:** PascalCase (e.g., `FsAdapter`, `S3Adapter`)
- **Interfaces:** PascalCase (e.g., `FileStorageAdapter`)
- **Methods:** camelCase (e.g., `getSignedUrl`)
- **Constants:** camelCase for config, UPPER_CASE for true constants

### File Organization

- `src/index.ts` - Main entry point with exports
- `src/index.test.ts` - Tests for the package
- `src/types.ts` - Type definitions (in core package)
- `README.md` - Package-specific documentation

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';
import { FsAdapter } from '@heilgar/file-storage-adapter-fs';

const app = express();
const storage = new FsAdapter({
  rootDir: '/var/storage',
  basePath: 'uploads'
});

app.post('/upload', async (req, res) => {
  try {
    const buffer = req.body; // Assuming body-parser
    const metadata = await storage.upload('file.jpg', buffer);
    res.json({ success: true, metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Switching Between Adapters

Use environment variables to switch adapters without code changes:

```typescript
function createAdapter() {
  switch (process.env.STORAGE_TYPE) {
    case 'fs':
      return new FsAdapter({
        rootDir: process.env.STORAGE_ROOT_DIR,
        basePath: process.env.STORAGE_BASE_PATH
      });
    case 's3':
      return new S3Adapter({
        bucket: process.env.S3_BUCKET,
        region: process.env.AWS_REGION,
        basePath: process.env.STORAGE_BASE_PATH
      });
    case 'vercel-blob':
      return new VercelBlobAdapter({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        basePath: process.env.STORAGE_BASE_PATH
      });
    default:
      throw new Error('Unknown storage type');
  }
}

const adapter = createAdapter();
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/file-storage-adapter.git`
3. Create a branch: `git checkout -b feature/your-feature`
4. Install dependencies: `npm install`
5. Make changes and test: `npm test`
6. Format code: `npm run check`
7. Commit and push changes
8. Open a pull request

## Troubleshooting

### Common Issues

**Issue:** Tests fail with "Cannot find module"
- **Solution:** Run `npm run build` before running tests

**Issue:** S3 adapter tests fail
- **Solution:** Ensure LocalStack is running: `docker compose up -d`

**Issue:** Type errors in IDE
- **Solution:** Rebuild packages: `npm run clean && npm run build`

**Issue:** Permission errors with filesystem adapter
- **Solution:** Ensure the `rootDir` has proper read/write permissions

## Resources

- **GitHub Repository:** https://github.com/heilgar/file-storage-adapter
- **NPM Packages:**
  - `@heilgar/file-storage-adapter-core`
  - `@heilgar/file-storage-adapter-fs`
  - `@heilgar/file-storage-adapter-s3`
  - `@heilgar/file-storage-adapter-vercel-blob`

## Version History

- **v1.0.4** - Current version
- Licensed under MIT License
- Maintained by Oleh Hrebeniuk

## Notes for LLMs

When working with this codebase:

1. **Always maintain the adapter pattern** - Each storage backend is a separate adapter implementing the same interface
2. **Preserve backward compatibility** - API changes should be additive, not breaking
3. **Follow existing patterns** - New adapters should follow the structure of existing ones
4. **Test thoroughly** - Every adapter must have comprehensive tests
5. **Document changes** - Update README files in both root and package directories
6. **Use TypeScript strictly** - Maintain full type safety across all packages
7. **Base path handling** - All adapters must properly handle the optional `basePath` configuration
8. **Error handling** - Errors should be descriptive and propagated correctly
9. **Consistency** - All adapters should behave identically for the same operations
10. **Dependencies** - Keep dependencies minimal and well-justified

## Key Files for Understanding

- `packages/core/src/types.ts` - Core type definitions and interfaces
- `packages/core/src/base-adapter.ts` - Shared adapter functionality
- `packages/fs/src/index.ts` - Reference implementation for filesystem
- `packages/s3/src/index.ts` - S3 adapter implementation
- `packages/vercel-blob/src/index.ts` - Vercel Blob implementation
- `README.md` - User-facing documentation
- `package.json` - Monorepo configuration and scripts
