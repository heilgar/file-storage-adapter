import {
  BaseAdapter,
  type DownloadOptions,
  type FileMetadata,
  type FileObject,
  type FileStorageAdapterConfig,
  type ListOptions,
  type ListResult,
  type SignedUrlOptions,
  type UploadOptions,
} from '@heilgar/file-storage-adapter-core';
import { copy, del, head, type ListBlobResult, list, type PutBlobResult, put } from '@vercel/blob';
import { lookup } from 'mime-types';

export interface VercelBlobAdapterConfig extends FileStorageAdapterConfig {
  token: string;
}

export class VercelBlobAdapter extends BaseAdapter {
  private static readonly DEFAULT_LIST_LIMIT = 1000;
  private static readonly DEFAULT_MIME_TYPE = 'application/octet-stream';

  private token: string;

  constructor(config: VercelBlobAdapterConfig) {
    super(config);
    this.token = config.token;
  }

  async upload(
    key: string,
    file: Buffer | NodeJS.ReadableStream | File,
    options?: UploadOptions,
  ): Promise<FileMetadata> {
    const fullKey = this.getFullKey(key);
    const buffer = await this.toBuffer(file);

    // Note: Vercel Blob only supports public access as of the current API version
    // Private access is not available in the free tier
    const blob: PutBlobResult = await put(fullKey, buffer, {
      access: 'public',
      contentType: options?.contentType,
      addRandomSuffix: false,
      token: this.token,
    });

    return {
      name: this.extractFileName(key),
      mimeType: options?.contentType || VercelBlobAdapter.DEFAULT_MIME_TYPE,
      sizeInBytes: buffer.length,
      uploadedAt: new Date(),
      customMetadata: {
        ...options?.metadata,
        url: blob.url,
        pathname: blob.pathname,
      },
    };
  }

  async download(key: string, options: DownloadOptions = {}): Promise<FileObject> {
    const fullKey = this.getFullKey(key);
    if (options.range) {
      throw new Error(
        'Range downloads are not supported by Vercel Blob. Consider downloading the full file and slicing in memory.',
      );
    }

    const metadata = await this.getMetadata(key);

    if (!metadata) {
      throw new Error(`File not found: ${key}`);
    }

    // Get the blob URL and fetch content
    const blobData = await head(fullKey, { token: this.token });
    const response = await fetch(blobData.url);
    const arrayBuffer = await response.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    return {
      ...metadata,
      content,
    };
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const fullKey = this.getFullKey(key);
      const blob = await head(fullKey, { token: this.token });

      return {
        name: this.extractFileName(key),
        mimeType: blob.contentType || VercelBlobAdapter.DEFAULT_MIME_TYPE,
        sizeInBytes: blob.size,
        uploadedAt: new Date(blob.uploadedAt),
      };
    } catch (error) {
      // File not found or access denied
      if (error instanceof Error && !error.message.includes('404')) {
        // Log unexpected errors for debugging
        // console.debug(`Failed to get metadata for key "${key}": ${error.message}`);
      }
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      await del(fullKey, { token: this.token });
      return true;
    } catch (error) {
      // File not found or access denied
      if (error instanceof Error && !error.message.includes('404')) {
        // Log unexpected errors for debugging
        // console.debug(`Failed to delete file at key "${key}": ${error.message}`);
      }
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const metadata = await this.getMetadata(key);
    return metadata !== null;
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const { prefix = '', limit = VercelBlobAdapter.DEFAULT_LIST_LIMIT, cursor } = options;
    const fullPrefix = this.getFullKey(prefix);

    const result: ListBlobResult = await list({
      prefix: fullPrefix,
      limit,
      cursor,
      token: this.token,
    });

    const files: FileMetadata[] = result.blobs.map((blob) => ({
      name: this.extractFileName(blob.pathname),
      mimeType: lookup(blob.pathname) || VercelBlobAdapter.DEFAULT_MIME_TYPE,
      sizeInBytes: blob.size,
      uploadedAt: new Date(blob.uploadedAt),
    }));

    return {
      files,
      nextCursor: result.cursor,
      hasMore: result.hasMore,
    };
  }

  async getSignedUrl(key: string, _options: SignedUrlOptions): Promise<string> {
    const fullKey = this.getFullKey(key);
    const blob = await head(fullKey, { token: this.token });
    return blob.url;
  }

  async getSignedUrlUpload(
    _key: string,
    _options: SignedUrlOptions,
  ): Promise<{ url: string; headers?: Record<string, string> }> {
    throw new Error(
      'Signed upload URLs are not supported for Vercel Blob adapter. Use the upload() method directly.',
    );
  }

  async copy(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const fullSourceKey = this.getFullKey(sourceKey);
    const fullDestKey = this.getFullKey(destinationKey);

    await copy(fullSourceKey, fullDestKey, {
      access: 'public',
      token: this.token,
    });

    // After copying, we need to get the metadata of the new file
    const metadata = await this.getMetadata(destinationKey);
    if (!metadata) {
      throw new Error(`Failed to copy file from "${sourceKey}" to "${destinationKey}"`);
    }

    return metadata;
  }

  async move(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const metadata = await this.copy(sourceKey, destinationKey);

    const deleted = await this.delete(sourceKey);
    if (!deleted) {
      // Source deletion failed - attempt rollback
      try {
        await this.delete(destinationKey);
      } catch (_rollbackError) {
        // Log rollback failure for debugging
        // console.debug(`Rollback failed during move operation: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
      throw new Error(
        `Failed to delete source file "${sourceKey}" after copying to "${destinationKey}"`,
      );
    }

    return metadata;
  }
}
