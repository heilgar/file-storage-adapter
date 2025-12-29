import { join } from 'node:path';
import type {
  DownloadOptions,
  FileMetadata,
  FileObject,
  FileStorageAdapter,
  FileStorageAdapterConfig,
  ListOptions,
  ListResult,
  SignedUrlOptions,
  SignedUrlUploadResult,
  UploadOptions,
} from './types';

export abstract class BaseAdapter implements FileStorageAdapter {
  constructor(protected config: FileStorageAdapterConfig = {}) {}

  /**
   * Prepends the base path to the given key if a base path is configured.
   *
   * @param key - The original file key
   *
   * @returns The full file key with base path prepended if applicable
   */
  protected getFullKey(key: string): string {
    if (this.config.basePath) {
      return join(this.config.basePath, key);
    }

    return key;
  }

  /**
   * Removes the base path from the given full key if a base path is configured.
   *
   * @param fullKey - The full file fullKey
   *
   * @returns The file key without the base path if applicable
   */
  protected stripBasePath(fullKey: string): string {
    if (this.config.basePath && fullKey.startsWith(this.config.basePath)) {
      return fullKey.slice(this.config.basePath.length + 1);
    }

    return fullKey;
  }

  /**
   * Converts various file input types to a Buffer.
   *
   * @param file - The file input (Buffer, Stream, or File)
   *
   * @returns A Promise that resolves to a Buffer
   */
  protected async toBuffer(file: Buffer | NodeJS.ReadableStream | File): Promise<Buffer> {
    if (Buffer.isBuffer(file)) {
      return file;
    }

    if ('stream' in file && typeof file.stream === 'function') {
      const arrayBuffer = await file.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file as NodeJS.ReadableStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  abstract upload(
    key: string,
    file: Buffer | NodeJS.ReadableStream | File,
    options?: UploadOptions,
  ): Promise<FileMetadata>;
  abstract download(key: string, options?: DownloadOptions): Promise<FileObject>;
  abstract getMetadata(key: string): Promise<FileMetadata | null>;
  abstract delete(key: string): Promise<boolean>;
  abstract exists(key: string): Promise<boolean>;
  abstract list(options?: ListOptions): Promise<ListResult>;
  abstract getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  abstract getSignedUrlUpload(
    key: string,
    options: SignedUrlOptions,
  ): Promise<SignedUrlUploadResult>;
  abstract copy(sourceKey: string, destinationKey: string): Promise<FileMetadata>;
  abstract move(sourceKey: string, destinationKey: string): Promise<FileMetadata>;
}
