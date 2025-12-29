import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { FileStorageAdapterConfig } from '@heilgar/file-storage-adapter-core';
import { FsAdapter } from './index';
import type { FsAdapterConfig } from './index';

describe('FsAdapterConfig', () => {
  it('matches the core FileStorageAdapterConfig type', () => {
    expectTypeOf<FsAdapterConfig>().toMatchTypeOf<FileStorageAdapterConfig>();
  });
});

describe('FsAdapter', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(join(tmpdir(), 'fs-adapter-test-'));
  });

  afterEach(async () => {
    if (rootDir) {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it('uploads and downloads files with metadata', async () => {
    const adapter = new FsAdapter({ rootDir });
    const metadata = await adapter.upload('nested/file.txt', Buffer.from('hello'));

    expect(metadata.name).toBe('file.txt');
    expect(metadata.size).toBe(5);
    expect(metadata.mimeType).toBe('text/plain');
    expect(metadata.uploadedAt).toBeInstanceOf(Date);

    const downloaded = await adapter.download('nested/file.txt');
    expect(downloaded.content).toEqual(Buffer.from('hello'));
    expect(downloaded.name).toBe('file.txt');
  });

  it('supports ranged downloads', async () => {
    const adapter = new FsAdapter({ rootDir });
    await adapter.upload('file.bin', Buffer.from('hello'));

    const downloaded = await adapter.download('file.bin', { range: { start: 1, end: 3 } });
    expect(downloaded.content).toEqual(Buffer.from('ell'));
  });

  it('falls back to file stats when metadata is missing', async () => {
    const adapter = new FsAdapter({ rootDir });
    await adapter.upload('file.txt', Buffer.from('data'));
    await fs.unlink(join(rootDir, 'file.txt.meta.json'));

    const metadata = await adapter.getMetadata('file.txt');
    expect(metadata).not.toBeNull();
    expect(metadata?.name).toBe('file.txt');
  });

  it('checks existence and deletes files', async () => {
    const adapter = new FsAdapter({ rootDir });
    expect(await adapter.exists('file.txt')).toBe(false);

    await adapter.upload('file.txt', Buffer.from('data'));
    expect(await adapter.exists('file.txt')).toBe(true);

    expect(await adapter.delete('file.txt')).toBe(true);
    expect(await adapter.exists('file.txt')).toBe(false);
  });

  it('lists files with basePath and prefix', async () => {
    const adapter = new FsAdapter({ rootDir, basePath: 'base' });
    await adapter.upload('dir/a.txt', Buffer.from('a'));
    await adapter.upload('dir/b.txt', Buffer.from('b'));

    const all = await adapter.list();
    expect(all.files.length).toBe(2);

    const filtered = await adapter.list({ prefix: 'dir' });
    expect(filtered.files.length).toBe(2);
  });

  it('returns a public URL when baseUrl is configured', async () => {
    const adapter = new FsAdapter({ rootDir, baseUrl: 'https://example.test', basePath: 'base' });
    await expect(adapter.getSignedUrl('file.txt', { expiresIn: 60 })).resolves.toBe(
      'https://example.test/base/file.txt',
    );
  });

  it('throws when requesting signed URLs without baseUrl', async () => {
    const adapter = new FsAdapter({ rootDir });
    await expect(adapter.getSignedUrl('file.txt', { expiresIn: 60 })).rejects.toThrow(
      'baseUrl not configured for FsAdapter',
    );
  });

  it('throws for signed upload URLs', async () => {
    const adapter = new FsAdapter({ rootDir });
    await expect(adapter.getSignedUrlUpload('file.txt', { expiresIn: 60 })).rejects.toThrow(
      'Signed upload URLs not supported for filesystem adapter',
    );
  });

  it('copies and moves files', async () => {
    const adapter = new FsAdapter({ rootDir });
    await adapter.upload('source.txt', Buffer.from('data'));

    await adapter.copy('source.txt', 'copy.txt');
    expect(await adapter.exists('copy.txt')).toBe(true);

    await adapter.move('source.txt', 'moved.txt');
    expect(await adapter.exists('source.txt')).toBe(false);
    expect(await adapter.exists('moved.txt')).toBe(true);
  });
});
