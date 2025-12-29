import {
  BaseAdapter,
  DownloadOptions,
  FileMetadata,
  FileObject,
  FileStorageAdapterConfig,
  ListOptions,
  ListResult,
  SignedUrlOptions,
  UploadOptions,
} from '@heilgar/file-storage-adapter-core';
import { createReadStream, promises as fs } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { lookup } from 'mime-types';

export interface FsAdapterConfig extends FileStorageAdapterConfig {
  rootDir: string;
  baseUrl?: string; // Optional base URL for public access
}

export class FsAdapter extends BaseAdapter {
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
    return `${this.getFilePath(key)}.meta.json`;
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

    const buffer = await this.toBuffer(file);
    await fs.writeFile(filePath, buffer);

    const stat = await fs.stat(filePath);
    const metadata: FileMetadata = {
      name: key.split('/').pop() || key,
      mimeType: options?.contentType || lookup(key) || 'application/octet-stream',
      size: stat.size,
      uploadedAt: new Date(),
      metadata: options?.metadata,
    };

    const metadataPath = this.getMetadataPath(key);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  async download(key: string, options?: DownloadOptions): Promise<FileObject> {
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    let content: Buffer;

    if (options?.range) {
      const { start, end } = options.range;
      const stream = createReadStream(filePath, { start, end });
      content = await this.toBuffer(stream);
    } else {
      content = await fs.readFile(filePath);
    }

    let metadata: FileMetadata;
    try {
      const metaContent = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metaContent);
      metadata.uploadedAt = new Date(metadata.uploadedAt);
    } catch {
      // Fallback if metadata doesn't exist
      const stats = await fs.stat(filePath);
      metadata = {
        name: key.split('/').pop() || key,
        mimeType: lookup(key) || 'application/octet-stream',
        size: stats.size,
        uploadedAt: stats.mtime,
      };
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
          name: key.split('/').pop() || key,
          mimeType: lookup(key) || 'application/octet-stream',
          size: stats.size,
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
      await fs.unlink(metadataPath).catch(() => {}); // Ignore if metadata doesn't exist

      return true;
    } catch {
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
    const { prefix = '', limit = 1000 } = options;
    const files: FileMetadata[] = [];

    const searchDir = prefix
      ? join(this.rootDir, this.getFullKey(prefix))
      : join(this.rootDir, this.config.basePath || '');

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (files.length >= limit) break;

          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
            const relativePath = relative(this.rootDir, fullPath);
            const key = this.stripBasePath(relativePath);

            const metadata = await this.getMetadata(key);
            if (metadata) {
              files.push(metadata);
            }
          }
        }
      } catch {
        // Directory doesn't exist or not accessible
      }
    };

    await walkDir(searchDir);

    return {
      files,
      hasMore: false, // Filesystem adapter loads all at once
    };
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
