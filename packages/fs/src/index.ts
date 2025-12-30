import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';
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
import { lookup } from 'mime-types';

export interface FsAdapterConfig extends FileStorageAdapterConfig {
  rootDir: string;
  baseUrl?: string; // Optional base URL for public access
}

export class FsAdapter extends BaseAdapter {
  private static readonly DEFAULT_LIST_LIMIT = 1000;
  private static readonly METADATA_FILE_EXTENSION = '.meta.json';

  private rootDir: string;
  private baseUrl?: string;

  constructor(config: FsAdapterConfig) {
    super(config);

    this.rootDir = config.rootDir;
    this.baseUrl = config.baseUrl;
  }

  private getFilePath(key: string): string {
    const fullKey = this.getFullKey(key);
    return join(this.rootDir, fullKey);
  }

  private getMetadataPath(key: string): string {
    return `${this.getFilePath(key)}${FsAdapter.METADATA_FILE_EXTENSION}`;
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async upload(
    key: string,
    file: Buffer | NodeJS.ReadableStream | File,
    options?: UploadOptions,
  ): Promise<FileMetadata> {
    const filePath = this.getFilePath(key);
    await this.ensureDir(filePath);

    if (Buffer.isBuffer(file)) {
      await fs.writeFile(filePath, file);
    } else if ('stream' in file && typeof file.stream === 'function') {
      const buffer = await this.toBuffer(file);
      await fs.writeFile(filePath, buffer);
    } else {
      await pipeline(file as NodeJS.ReadableStream, createWriteStream(filePath));
    }

    const stat = await fs.stat(filePath);
    const metadata: FileMetadata = {
      name: this.extractFileName(key),
      mimeType: options?.contentType || lookup(key) || 'application/octet-stream',
      sizeInBytes: stat.size,
      uploadedAt: new Date(),
      customMetadata: options?.metadata,
    };

    const metadataPath = this.getMetadataPath(key);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  async download(key: string, options?: DownloadOptions): Promise<FileObject> {
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    let content: Buffer;

    try {
      if (options?.range) {
        const { startByte, endByte } = options.range;
        const stream = createReadStream(filePath, { start: startByte, end: endByte });
        content = await this.toBuffer(stream);
      } else {
        content = await fs.readFile(filePath);
      }
    } catch (error) {
      throw new Error(
        `Failed to read file at key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    let metadata: FileMetadata;
    try {
      const metaContent = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metaContent);
      metadata.uploadedAt = new Date(metadata.uploadedAt);
    } catch (metadataError) {
      // Fallback to file stats if metadata doesn't exist
      try {
        const stats = await fs.stat(filePath);
        metadata = {
          name: this.extractFileName(key),
          mimeType: lookup(key) || 'application/octet-stream',
          sizeInBytes: stats.size,
          uploadedAt: stats.mtime,
        };
      } catch (statsError) {
        throw new Error(
          `Failed to retrieve metadata for file at key "${key}": ${statsError instanceof Error ? statsError.message : 'Unknown error'}`,
        );
      }
    }

    return {
      ...metadata,
      content,
    };
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const metadataPath = this.getMetadataPath(key);
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      metadata.uploadedAt = new Date(metadata.uploadedAt);
      return metadata;
    } catch {
      // Try to get basic metadata from file stats
      try {
        const filePath = this.getFilePath(key);
        const stats = await fs.stat(filePath);
        return {
          name: this.extractFileName(key),
          mimeType: lookup(key) || 'application/octet-stream',
          sizeInBytes: stats.size,
          uploadedAt: stats.mtime,
        };
      } catch {
        return null;
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      const metadataPath = this.getMetadataPath(key);

      await fs.unlink(filePath);

      // Try to delete metadata file, but don't fail if it doesn't exist
      try {
        await fs.unlink(metadataPath);
      } catch (metadataError) {
        // Metadata file may not exist, which is acceptable
        // Log for debugging if needed: console.debug(`Metadata file not found for key "${key}"`);
      }

      return true;
    } catch (error) {
      // File doesn't exist or permission denied
      // Consider logging: console.debug(`Failed to delete file at key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const { prefix = '', limit = FsAdapter.DEFAULT_LIST_LIMIT } = options;
    const searchDir = this.getSearchDirectory(prefix);

    const files = await this.collectFiles(searchDir, limit);

    return {
      files,
      hasMore: limit > 0 && files.length >= limit,
    };
  }

  private getSearchDirectory(prefix: string): string {
    return prefix
      ? join(this.rootDir, this.getFullKey(prefix))
      : join(this.rootDir, this.config.basePath || '');
  }

  private async collectFiles(directory: string, limit: number): Promise<FileMetadata[]> {
    const files: FileMetadata[] = [];
    await this.walkDirectory(directory, files, limit);
    return files;
  }

  private async walkDirectory(dir: string, files: FileMetadata[], limit: number): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= limit) break;

        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, files, limit);
        } else if (this.isDataFile(entry.name)) {
          const metadata = await this.getFileMetadataForListing(fullPath);
          if (metadata) {
            files.push(metadata);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or not accessible
      // Consider logging: console.debug(`Failed to read directory "${dir}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isDataFile(fileName: string): boolean {
    return !fileName.endsWith(FsAdapter.METADATA_FILE_EXTENSION);
  }

  private async getFileMetadataForListing(fullPath: string): Promise<FileMetadata | null> {
    const relativePath = relative(this.rootDir, fullPath);
    const key = this.stripBasePath(relativePath);
    return this.getMetadata(key);
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    // Filesystem doesn't support signed URLs, return public URL if baseUrl is set
    if (this.baseUrl) {
      const fullKey = this.getFullKey(key);
      return `${this.baseUrl}/${fullKey}`;
    }
    throw new Error('baseUrl not configured for FsAdapter');
  }

  async getSignedUrlUpload(
    key: string,
    options: SignedUrlOptions,
  ): Promise<{ url: string; headers?: Record<string, string> }> {
    throw new Error('Signed upload URLs not supported for filesystem adapter');
  }

  async copy(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const sourcePath = this.getFilePath(sourceKey);
    const destPath = this.getFilePath(destinationKey);

    await this.ensureDir(destPath);
    await fs.copyFile(sourcePath, destPath);

    // Copy metadata
    const sourceMetaPath = this.getMetadataPath(sourceKey);
    const destMetaPath = this.getMetadataPath(destinationKey);
    try {
      await fs.copyFile(sourceMetaPath, destMetaPath);
    } catch {
      // Metadata doesn't exist, create new
    }

    const metadata = await this.getMetadata(destinationKey);
    if (!metadata) {
      throw new Error('Failed to copy file');
    }

    return metadata;
  }

  async move(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const metadata = await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    return metadata;
  }
}
