import {
  BaseAdapter,
  type DeleteByPrefixOptions,
  type DeleteByPrefixResult,
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
import {
  copy,
  del,
  get,
  head,
  issueSignedToken,
  type ListBlobResult,
  list,
  type PutBlobResult,
  presignUrl,
  put,
} from '@vercel/blob';
import { lookup } from 'mime-types';

export type VercelBlobAccess = 'public' | 'private';

export interface VercelBlobAdapterConfig extends FileStorageAdapterConfig {
  token: string;
  /**
   * Access mode of the Blob store. Must match how the store was created in Vercel.
   * @defaultValue 'public'
   */
  access?: VercelBlobAccess;
}

export class VercelBlobAdapter extends BaseAdapter {
  private static readonly DEFAULT_LIST_LIMIT = 1000;
  private static readonly DEFAULT_MIME_TYPE = 'application/octet-stream';
  private static readonly DEFAULT_SIGNED_URL_EXPIRATION = 3600;

  private token: string;
  private access: VercelBlobAccess;

  constructor(config: VercelBlobAdapterConfig) {
    super(config);
    this.token = config.token;
    this.access = config.access ?? 'public';
  }

  async upload(
    key: string,
    file: Buffer | NodeJS.ReadableStream | File,
    options?: UploadOptions,
  ): Promise<FileMetadata> {
    const fullKey = this.getFullKey(key);
    const buffer = await this.toBuffer(file);

    const blob: PutBlobResult = await put(fullKey, buffer, {
      access: this.access,
      contentType: options?.contentType,
      addRandomSuffix: false,
      token: this.token,
    });

    return {
      name: this.extractFileName(key),
      key,
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

    let content: Buffer;
    if (this.access === 'private') {
      const result = await get(fullKey, { access: 'private', token: this.token });
      if (!result || result.statusCode !== 200) {
        throw new Error(`File not found: ${key}`);
      }
      const arrayBuffer = await new Response(result.stream).arrayBuffer();
      content = Buffer.from(arrayBuffer);
    } else {
      const blobData = await head(fullKey, { token: this.token });
      const response = await fetch(blobData.url);
      const arrayBuffer = await response.arrayBuffer();
      content = Buffer.from(arrayBuffer);
    }

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
        key,
        mimeType: blob.contentType || VercelBlobAdapter.DEFAULT_MIME_TYPE,
        sizeInBytes: blob.size,
        uploadedAt: new Date(blob.uploadedAt),
      };
    } catch (error) {
      if (error instanceof Error && !error.message.includes('404')) {
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
      if (error instanceof Error && !error.message.includes('404')) {
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

    const files: FileMetadata[] = result.blobs.map((blob) => {
      const strippedKey = this.stripBasePath(blob.pathname);
      return {
        name: this.extractFileName(strippedKey),
        key: strippedKey,
        mimeType: lookup(blob.pathname) || VercelBlobAdapter.DEFAULT_MIME_TYPE,
        sizeInBytes: blob.size,
        uploadedAt: new Date(blob.uploadedAt),
      };
    });

    return {
      files,
      nextCursor: result.cursor,
      hasMore: result.hasMore,
    };
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const fullKey = this.getFullKey(key);

    if (this.access === 'public') {
      const blob = await head(fullKey, { token: this.token });
      return blob.url;
    }

    const expiresInSec = options.expiresIn || VercelBlobAdapter.DEFAULT_SIGNED_URL_EXPIRATION;
    const validUntil = Date.now() + expiresInSec * 1000;
    const signedToken = await issueSignedToken({
      pathname: fullKey,
      operations: ['get'],
      validUntil,
      token: this.token,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: 'get',
      pathname: fullKey,
      access: 'private',
      validUntil,
    });
    return presignedUrl;
  }

  async getSignedUrlUpload(key: string, options: SignedUrlOptions): Promise<SignedUrlUploadResult> {
    if (this.access === 'public') {
      throw new Error(
        'Signed upload URLs are not supported for public Vercel Blob stores. Use the upload() method directly.',
      );
    }

    const fullKey = this.getFullKey(key);
    const expiresInSec = options.expiresIn || VercelBlobAdapter.DEFAULT_SIGNED_URL_EXPIRATION;
    const validUntil = Date.now() + expiresInSec * 1000;
    const allowedContentTypes = options.contentType ? [options.contentType] : undefined;

    const signedToken = await issueSignedToken({
      pathname: fullKey,
      operations: ['put'],
      validUntil,
      allowedContentTypes,
      token: this.token,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: 'put',
      pathname: fullKey,
      access: 'private',
      validUntil,
      allowedContentTypes,
    });

    return {
      url: presignedUrl,
      headers: options.contentType ? { 'Content-Type': options.contentType } : undefined,
    };
  }

  async copy(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const fullSourceKey = this.getFullKey(sourceKey);
    const fullDestKey = this.getFullKey(destinationKey);

    await copy(fullSourceKey, fullDestKey, {
      access: this.access,
      token: this.token,
    });

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
      try {
        await this.delete(destinationKey);
      } catch (_rollbackError) {
        // console.debug(`Rollback failed during move operation: ...`);
      }
      throw new Error(
        `Failed to delete source file "${sourceKey}" after copying to "${destinationKey}"`,
      );
    }

    return metadata;
  }

  async deleteByPrefix(
    prefix: string,
    opts: DeleteByPrefixOptions = {},
  ): Promise<DeleteByPrefixResult> {
    this.assertDeleteByPrefixPrefix(prefix);
    this.assertDeleteByPrefixOptions(opts);
    if (opts.limit === 0) return { deleted: 0 };

    const fullPrefix = this.getFullKey(prefix);
    let cursor: string | undefined;
    let deleted = 0;

    do {
      const pageLimit = this.nextPageLimit(deleted, opts, 100);

      const page = await list({
        prefix: fullPrefix,
        limit: pageLimit,
        cursor,
        token: this.token,
      });

      if (page.blobs.length > 0) {
        // Use pathname for consistency with delete()/upload(); del() also accepts URLs
        // but mixing identifier types across the adapter risks divergence.
        await del(
          page.blobs.map((b) => b.pathname),
          { token: this.token },
        );
        deleted += page.blobs.length;
      }

      if (page.hasMore) {
        if (!page.cursor) {
          // Truncate caller-supplied prefix to avoid leaking PII into error logs.
          const safePrefix = prefix.length > 32 ? `${prefix.slice(0, 32)}…` : prefix;
          throw new Error(
            `Vercel Blob reported hasMore=true but returned no cursor for deleteByPrefix(prefix=${safePrefix}); refusing to silently truncate`,
          );
        }
        cursor = page.cursor;
      } else {
        cursor = undefined;
      }
      if (opts.limit !== undefined && deleted >= opts.limit) break;
    } while (cursor);

    return { deleted };
  }
}
