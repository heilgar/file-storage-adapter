# File Storage Adapter S3

S3-compatible storage implementation of the file storage adapter. Works with AWS S3, LocalStack, and other S3-compatible services.

## Install

```sh
npm install @heilgar/file-storage-adapter-s3
```

## Usage

```ts
import { S3Adapter } from '@heilgar/file-storage-adapter-s3';

const adapter = new S3Adapter({
  bucket: 'my-bucket',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  basePath: 'uploads',
});

const metadata = await adapter.upload('images/logo.png', Buffer.from('...'));
const file = await adapter.download('images/logo.png');
const list = await adapter.list({ prefix: 'images' });
const url = await adapter.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

## Configuration

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

**Required fields:**
- `bucket` - S3 bucket name
- `region` - AWS region

**Optional fields:**
- `credentials` - AWS credentials object with `accessKeyId` and `secretAccessKey`
- `endpoint` - Custom S3 endpoint (for LocalStack or S3-compatible services)
- `forcePathStyle` - Use path-style URLs instead of virtual-hosted-style (required for LocalStack)
- `basePath` - Prefix for all keys

## LocalStack Development

For local development and testing, you can use LocalStack:

```ts
const adapter = new S3Adapter({
  bucket: 'local-storage-bucket',
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: {
    accessKeyId: 'dev',
    secretAccessKey: 'dev',
  },
  forcePathStyle: true,
});
```


## Notes

- Custom metadata values are stored as S3 object metadata (converted to strings)
- Signed URLs support both download (GetObject) and upload (PutObject) operations
- Pagination is supported via continuation tokens
- Range downloads allow fetching partial file content

