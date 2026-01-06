import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BaseAdapter,
  type DownloadOptions,
  type FileMetadata,
  type FileObject,
  type FileStorageAdapterConfig,
  type ListOptions,
  type ListResult,
  type SignedUrlOptions,
  type SignedUrlUploadResult,
  type UploadOptions,
} from '@heilgar/file-storage-adapter-core';
import { lookup } from 'mime-types';

export interface S3AdapterConfig extends FileStorageAdapterConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean;
}

export class S3Adapter extends BaseAdapter {
  private static readonly DEFAULT_LIST_LIMIT = 1000;
  private static readonly DEFAULT_MIME_TYPE = 'application/octet-stream';
  private static readonly SIGNED_URL_EXPIRATION = 3600; // 1 hour default

  private client: S3Client;
  private bucket: string;

  constructor(config: S3AdapterConfig) {
    super(config);

    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: config.credentials,
      forcePathStyle: config.forcePathStyle,
    });
  }

  async upload(
    key: string,
    file: Buffer | NodeJS.ReadableStream | File,
    options?: UploadOptions,
  ): Promise<FileMetadata> {
    const fullKey = this.getFullKey(key);
    const buffer = await this.toBuffer(file);
    const contentType = options?.contentType || lookup(key) || S3Adapter.DEFAULT_MIME_TYPE;

    const metadata: Record<string, string> = {};
    if (options?.metadata) {
      // Convert custom metadata to S3 metadata format (string values only)
      Object.entries(options.metadata).forEach(([k, v]) => {
        metadata[k] = String(v);
      });
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: options?.cacheControl,
      Metadata: metadata,
      ACL: options?.isPubliclyAccessible ? 'public-read' : 'private',
    });

    await this.client.send(command);

    return {
      name: this.extractFileName(key),
      mimeType: contentType,
      sizeInBytes: buffer.length,
      uploadedAt: new Date(),
      customMetadata: options?.metadata,
    };
  }

  async download(key: string, options?: DownloadOptions): Promise<FileObject> {
    const fullKey = this.getFullKey(key);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Range: options?.range
        ? `bytes=${options.range.startByte}-${options.range.endByte}`
        : undefined,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`Failed to download file: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks);

    return {
      name: this.extractFileName(key),
      mimeType: response.ContentType || S3Adapter.DEFAULT_MIME_TYPE,
      sizeInBytes: response.ContentLength || content.length,
      uploadedAt: response.LastModified || new Date(),
      customMetadata: response.Metadata,
      content,
    };
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const fullKey = this.getFullKey(key);
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      });

      const response = await this.client.send(command);

      return {
        name: this.extractFileName(key),
        mimeType: response.ContentType || S3Adapter.DEFAULT_MIME_TYPE,
        sizeInBytes: response.ContentLength || 0,
        uploadedAt: response.LastModified || new Date(),
        customMetadata: response.Metadata,
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const metadata = await this.getMetadata(key);
    return metadata !== null;
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const { prefix = '', limit = S3Adapter.DEFAULT_LIST_LIMIT, cursor } = options;
    const fullPrefix = this.getFullKey(prefix);

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: fullPrefix,
      MaxKeys: limit,
      ContinuationToken: cursor,
    });

    const response = await this.client.send(command);

    const files: FileMetadata[] = (response.Contents || []).map((obj) => ({
      name: this.extractFileName(this.stripBasePath(obj.Key || '')),
      mimeType: lookup(obj.Key || '') || S3Adapter.DEFAULT_MIME_TYPE,
      sizeInBytes: obj.Size || 0,
      uploadedAt: obj.LastModified || new Date(),
    }));

    return {
      files,
      nextCursor: response.NextContinuationToken,
      hasMore: response.IsTruncated || false,
    };
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn || S3Adapter.SIGNED_URL_EXPIRATION,
    });
  }

  async getSignedUrlUpload(key: string, options: SignedUrlOptions): Promise<SignedUrlUploadResult> {
    const fullKey = this.getFullKey(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      ContentType: options.contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn || S3Adapter.SIGNED_URL_EXPIRATION,
    });

    return {
      url,
      headers: options.contentType
        ? {
            'Content-Type': options.contentType,
          }
        : undefined,
    };
  }

  async copy(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const fullSourceKey = this.getFullKey(sourceKey);
    const fullDestKey = this.getFullKey(destinationKey);

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${fullSourceKey}`,
      Key: fullDestKey,
    });

    await this.client.send(command);

    const metadata = await this.getMetadata(destinationKey);
    if (!metadata) {
      throw new Error(`Failed to copy file from "${sourceKey}" to "${destinationKey}"`);
    }

    return metadata;
  }

  async move(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const metadata = await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    return metadata;
  }
}
