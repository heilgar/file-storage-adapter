import type { FileStorageAdapterConfig } from '@heilgar/file-storage-adapter-core';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { S3AdapterConfig } from './index';
import { S3Adapter } from './index';

describe('S3AdapterConfig', () => {
  it('matches the core FileStorageAdapterConfig type', () => {
    expectTypeOf<S3AdapterConfig>().toMatchTypeOf<FileStorageAdapterConfig>();
  });
});

describe('S3Adapter', () => {
  let adapter: S3Adapter;
  const testBucket = 'local-storage-bucket';

  beforeEach(async () => {
    adapter = new S3Adapter({
      bucket: testBucket,
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
      credentials: {
        accessKeyId: 'dev',
        secretAccessKey: 'dev',
      },
      forcePathStyle: true,
    });

    // Clean up any existing test files
    const files = await adapter.list();
    for (const file of files.files) {
      await adapter.delete(file.name);
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await adapter.list();
      for (const file of files.files) {
        await adapter.delete(file.name);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('uploads and downloads files with metadata', async () => {
    const metadata = await adapter.upload('nested/file.txt', Buffer.from('hello'));

    expect(metadata.name).toBe('file.txt');
    expect(metadata.sizeInBytes).toBe(5);
    expect(metadata.mimeType).toBe('text/plain');
    expect(metadata.uploadedAt).toBeInstanceOf(Date);

    const downloaded = await adapter.download('nested/file.txt');
    expect(downloaded.content).toEqual(Buffer.from('hello'));
    expect(downloaded.name).toBe('file.txt');
  });

  it('uploads files with custom metadata', async () => {
    const customMetadata = { userId: '123', category: 'documents' };
    const metadata = await adapter.upload('file.txt', Buffer.from('data'), {
      metadata: customMetadata,
    });

    expect(metadata.customMetadata).toEqual(customMetadata);

    const retrieved = await adapter.getMetadata('file.txt');
    expect(retrieved?.customMetadata).toEqual(customMetadata);
  });

  it('supports ranged downloads', async () => {
    await adapter.upload('file.bin', Buffer.from('hello world'));

    const downloaded = await adapter.download('file.bin', { range: { startByte: 0, endByte: 4 } });
    expect(downloaded.content).toEqual(Buffer.from('hello'));
  });

  it('checks existence and deletes files', async () => {
    expect(await adapter.exists('file.txt')).toBe(false);

    await adapter.upload('file.txt', Buffer.from('data'));
    expect(await adapter.exists('file.txt')).toBe(true);

    expect(await adapter.delete('file.txt')).toBe(true);
    expect(await adapter.exists('file.txt')).toBe(false);
  });

  it('returns null for non-existent file metadata', async () => {
    const metadata = await adapter.getMetadata('non-existent.txt');
    expect(metadata).toBeNull();
  });

  it('lists files with basePath and prefix', async () => {
    const adapterWithBase = new S3Adapter({
      bucket: testBucket,
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
      credentials: {
        accessKeyId: 'dev',
        secretAccessKey: 'dev',
      },
      forcePathStyle: true,
      basePath: 'base',
    });

    await adapterWithBase.upload('dir/a.txt', Buffer.from('a'));
    await adapterWithBase.upload('dir/b.txt', Buffer.from('b'));
    await adapterWithBase.upload('other/c.txt', Buffer.from('c'));

    const all = await adapterWithBase.list();
    expect(all.files.length).toBe(3);
    expect(all.hasMore).toBe(false);

    const filtered = await adapterWithBase.list({ prefix: 'dir' });
    expect(filtered.files.length).toBe(2);

    // Cleanup
    await adapterWithBase.delete('dir/a.txt');
    await adapterWithBase.delete('dir/b.txt');
    await adapterWithBase.delete('other/c.txt');
  });

  it('marks hasMore when the limit is reached', async () => {
    await adapter.upload('a.txt', Buffer.from('a'));
    await adapter.upload('b.txt', Buffer.from('b'));
    await adapter.upload('c.txt', Buffer.from('c'));

    const limited = await adapter.list({ limit: 2 });
    expect(limited.files.length).toBe(2);
    expect(limited.hasMore).toBe(true);
    expect(limited.nextCursor).toBeDefined();
  });

  it('supports pagination with cursor', async () => {
    await adapter.upload('page/a.txt', Buffer.from('a'));
    await adapter.upload('page/b.txt', Buffer.from('b'));
    await adapter.upload('page/c.txt', Buffer.from('c'));

    const firstPage = await adapter.list({ prefix: 'page/', limit: 2 });
    expect(firstPage.files.length).toBe(2);
    expect(firstPage.hasMore).toBe(true);

    const secondPage = await adapter.list({ prefix: 'page/', limit: 2, cursor: firstPage.nextCursor });
    expect(secondPage.files.length).toBe(1);
    expect(secondPage.hasMore).toBe(false);
  });

  it('generates signed download URLs', async () => {
    await adapter.upload('file.txt', Buffer.from('test content'));

    const url = await adapter.getSignedUrl('file.txt', { expiresIn: 3600 });
    expect(url).toContain('localhost:4566');
    expect(url).toContain(testBucket);
    expect(url).toContain('file.txt');
    expect(url).toContain('X-Amz-Signature');

    // Verify the signed URL works
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const content = await response.text();
    expect(content).toBe('test content');
  });

  it('generates signed upload URLs', async () => {
    const result = await adapter.getSignedUrlUpload('upload.txt', {
      expiresIn: 3600,
      contentType: 'text/plain',
    });

    expect(result.url).toContain('localhost:4566');
    expect(result.url).toContain(testBucket);
    expect(result.url).toContain('upload.txt');
    expect(result.url).toContain('X-Amz-Signature');
    expect(result.headers).toEqual({ 'Content-Type': 'text/plain' });

    // Verify the signed URL works for upload
    const uploadResponse = await fetch(result.url, {
      method: 'PUT',
      body: 'uploaded via signed url',
      headers: result.headers || {},
    });
    expect(uploadResponse.ok).toBe(true);

    // Verify file was uploaded
    const downloaded = await adapter.download('upload.txt');
    expect(downloaded.content.toString()).toBe('uploaded via signed url');
  });

  it('copies files', async () => {
    await adapter.upload('source.txt', Buffer.from('original content'));

    const metadata = await adapter.copy('source.txt', 'destination.txt');
    expect(metadata.name).toBe('destination.txt');

    const source = await adapter.download('source.txt');
    const destination = await adapter.download('destination.txt');

    expect(source.content).toEqual(destination.content);
    expect(destination.content.toString()).toBe('original content');
  });

  it('moves files', async () => {
    await adapter.upload('source.txt', Buffer.from('move me'));

    const metadata = await adapter.move('source.txt', 'moved.txt');
    expect(metadata.name).toBe('moved.txt');

    expect(await adapter.exists('source.txt')).toBe(false);
    expect(await adapter.exists('moved.txt')).toBe(true);

    const moved = await adapter.download('moved.txt');
    expect(moved.content.toString()).toBe('move me');
  });

  it('handles content type correctly', async () => {
    await adapter.upload('image.png', Buffer.from('fake-image-data'), {
      contentType: 'image/png',
    });

    const metadata = await adapter.getMetadata('image.png');
    expect(metadata?.mimeType).toBe('image/png');

    const downloaded = await adapter.download('image.png');
    expect(downloaded.mimeType).toBe('image/png');
  });

  it('uploads public files with correct ACL', async () => {
    await adapter.upload('public.txt', Buffer.from('public data'), {
      isPubliclyAccessible: true,
    });

    const metadata = await adapter.getMetadata('public.txt');
    expect(metadata).not.toBeNull();
  });

  it('handles cache control', async () => {
    await adapter.upload('cached.txt', Buffer.from('cache me'), {
      cacheControl: 'max-age=3600',
    });

    const metadata = await adapter.getMetadata('cached.txt');
    expect(metadata).not.toBeNull();
  });
});
