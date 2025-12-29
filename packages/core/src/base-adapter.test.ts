import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { BaseAdapter } from './base-adapter';
import type {
  DownloadOptions,
  FileMetadata,
  FileObject,
  ListOptions,
  ListResult,
  SignedUrlOptions,
  SignedUrlUploadResult,
  UploadOptions,
} from './types';

class TestAdapter extends BaseAdapter {
  async upload(
    _key: string,
    _file: Buffer | NodeJS.ReadableStream | File,
    _options?: UploadOptions,
  ): Promise<FileMetadata> {
    throw new Error('not implemented');
  }
  async download(_key: string, _options?: DownloadOptions): Promise<FileObject> {
    throw new Error('not implemented');
  }
  async getMetadata(_key: string): Promise<FileMetadata | null> {
    throw new Error('not implemented');
  }
  async delete(_key: string): Promise<boolean> {
    throw new Error('not implemented');
  }
  async exists(_key: string): Promise<boolean> {
    throw new Error('not implemented');
  }
  async list(_options?: ListOptions): Promise<ListResult> {
    throw new Error('not implemented');
  }
  async getSignedUrl(_key: string, _options: SignedUrlOptions): Promise<string> {
    throw new Error('not implemented');
  }
  async getSignedUrlUpload(
    _key: string,
    _options: SignedUrlOptions,
  ): Promise<SignedUrlUploadResult> {
    throw new Error('not implemented');
  }
  async copy(_sourceKey: string, _destinationKey: string): Promise<FileMetadata> {
    throw new Error('not implemented');
  }
  async move(_sourceKey: string, _destinationKey: string): Promise<FileMetadata> {
    throw new Error('not implemented');
  }
}

describe('BaseAdapter', () => {
  it('returns the key unchanged when no basePath is set', () => {
    const adapter = new TestAdapter();
    expect(adapter['getFullKey']('file.txt')).toBe('file.txt');
  });

  it('prepends basePath when building a full key', () => {
    const adapter = new TestAdapter({ basePath: 'root' });
    expect(adapter['getFullKey']('file.txt')).toBe(join('root', 'file.txt'));
  });

  it('strips basePath from full keys', () => {
    const adapter = new TestAdapter({ basePath: 'root' });
    const fullKey = join('root', 'nested', 'file.txt');
    expect(adapter['stripBasePath'](fullKey)).toBe(join('nested', 'file.txt'));
  });

  it('leaves full keys intact when basePath does not match', () => {
    const adapter = new TestAdapter({ basePath: 'root' });
    expect(adapter['stripBasePath']('other/file.txt')).toBe('other/file.txt');
  });

  it('returns the same buffer instance', async () => {
    const adapter = new TestAdapter();
    const input = Buffer.from('data');
    await expect(adapter['toBuffer'](input)).resolves.toBe(input);
  });

  it('converts a readable stream to a buffer', async () => {
    const adapter = new TestAdapter();
    const stream = Readable.from([Buffer.from('hel'), 'lo']);
    await expect(adapter['toBuffer'](stream)).resolves.toEqual(Buffer.from('hello'));
  });

  it('converts file-like objects to a buffer via arrayBuffer', async () => {
    const adapter = new TestAdapter();
    const fileLike = {
      stream() {
        return null;
      },
      async arrayBuffer() {
        return Uint8Array.from([1, 2, 3]).buffer;
      },
    } as unknown as File;
    await expect(adapter['toBuffer'](fileLike)).resolves.toEqual(Buffer.from([1, 2, 3]));
  });
});
