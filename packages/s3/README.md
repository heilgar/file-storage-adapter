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

- `bucket` (required) - S3 bucket name
- `region` (required) - AWS region
- `credentials` (optional) - AWS credentials object with `accessKeyId` and `secretAccessKey`
- `endpoint` (optional) - Custom S3 endpoint (for LocalStack or S3-compatible services)
- `forcePathStyle` (optional) - Use path-style URLs instead of virtual-hosted-style (required for LocalStack)
- `basePath` (optional) - Prefix for all keys

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

