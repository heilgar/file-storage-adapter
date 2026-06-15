import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.VERCEL_BLOB_API_URL = 'http://localhost:3100/api/blob';
  process.env.VERCEL_BLOB_RETRIES = '0';
});

import { VercelBlobAdapter } from './index';

const TOKEN = 'vercel_blob_rw_emulator_local';

async function clearAll(adapter: VercelBlobAdapter): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await adapter.list({ limit: 1000, cursor });
    for (const f of page.files) await adapter.delete(f.key);
    cursor = page.hasMore ? page.nextCursor : undefined;
  } while (cursor);
}

describe('VercelBlobAdapter', () => {
  let adapter: VercelBlobAdapter;

  beforeEach(async () => {
    adapter = new VercelBlobAdapter({ token: TOKEN });
    await clearAll(adapter);
  });

  afterEach(async () => {
    try {
      await clearAll(adapter);
    } catch {
      // ignore cleanup errors
    }
  });

  it('uploads, downloads, and exposes key on metadata', async () => {
    const md = await adapter.upload('nested/hello.txt', Buffer.from('hello'), {
      contentType: 'text/plain',
    });

    expect(md.key).toBe('nested/hello.txt');
    expect(md.name).toBe('hello.txt');
    expect(md.mimeType).toBe('text/plain');
    expect(md.sizeInBytes).toBe(5);

    const obj = await adapter.download('nested/hello.txt');
    expect(obj.content.toString()).toBe('hello');
    expect(obj.key).toBe('nested/hello.txt');
  });

  it('checks existence and deletes files', async () => {
    await adapter.upload('exists.txt', Buffer.from('1'));
    expect(await adapter.exists('exists.txt')).toBe(true);

    expect(await adapter.delete('exists.txt')).toBe(true);
    expect(await adapter.exists('exists.txt')).toBe(false);
  });

  it('returns null for non-existent file metadata', async () => {
    expect(await adapter.getMetadata('does-not-exist.txt')).toBeNull();
  });

  it('lists files with prefix and key round-trips through delete/exists', async () => {
    await adapter.upload('list/a.txt', Buffer.from('a'));
    await adapter.upload('list/b.txt', Buffer.from('b'));
    await adapter.upload('other/c.txt', Buffer.from('c'));

    const result = await adapter.list({ prefix: 'list/' });
    const keys = result.files.map((f) => f.key).sort();
    expect(keys).toEqual(['list/a.txt', 'list/b.txt']);

    for (const f of result.files) {
      expect(await adapter.exists(f.key)).toBe(true);
    }
  });

  it('honours basePath: list returns stripped keys that round-trip', async () => {
    const scoped = new VercelBlobAdapter({ token: TOKEN, basePath: 'tenant-a' });
    try {
      await scoped.upload('scoped/a.txt', Buffer.from('a'));

      const { files } = await scoped.list({ prefix: 'scoped/' });
      expect(files.map((f) => f.key)).toEqual(['scoped/a.txt']);

      expect(await scoped.exists('scoped/a.txt')).toBe(true);
      expect((await scoped.download('scoped/a.txt')).content.toString()).toBe('a');
    } finally {
      await clearAll(scoped);
    }
  });

  // The payloadcms/vercel-blob-emulator's `copy` produces a zero-byte destination
  // (verified at the SDK level — see https://github.com/payloadcms/vercel-blob-emulator).
  // The adapter's copy/move plumbing is structurally identical to the S3 adapter's,
  // which is covered end-to-end against Floci. Re-enable once the emulator copies bytes.
  it.skip('copies files', async () => {
    await adapter.upload('source.txt', Buffer.from('content'));

    const dest = await adapter.copy('source.txt', 'destination.txt');
    expect(dest.key).toBe('destination.txt');

    expect(await adapter.exists('source.txt')).toBe(true);
    expect(await adapter.exists('destination.txt')).toBe(true);
    expect((await adapter.download('destination.txt')).content.toString()).toBe('content');
  });

  it.skip('moves files', async () => {
    await adapter.upload('source.txt', Buffer.from('content'));

    await adapter.move('source.txt', 'moved.txt');

    expect(await adapter.exists('source.txt')).toBe(false);
    expect(await adapter.exists('moved.txt')).toBe(true);
    expect((await adapter.download('moved.txt')).content.toString()).toBe('content');
  });

  it('throws on getSignedUrlUpload for public access', async () => {
    await expect(adapter.getSignedUrlUpload('file.txt', { expiresIn: 60 })).rejects.toThrow(
      /public/i,
    );
  });

  it('getSignedUrl for public access returns the underlying blob URL', async () => {
    await adapter.upload('signed.txt', Buffer.from('signed'));
    const url = await adapter.getSignedUrl('signed.txt', { expiresIn: 60 });
    expect(url).toMatch(/^https?:\/\//);
  });

  describe('deleteByPrefix', () => {
    it('paginates across pages and deletes everything under a prefix', async () => {
      for (let i = 0; i < 7; i++) {
        await adapter.upload(`bulk/file-${i}.txt`, Buffer.from(`x${i}`));
      }

      const { deleted } = await adapter.deleteByPrefix('bulk/', { batch: 3 });

      expect(deleted).toBe(7);
      expect((await adapter.list({ prefix: 'bulk/' })).files).toHaveLength(0);
    });

    it('honours limit and stops once reached', async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.upload(`cap/file-${i}.txt`, Buffer.from(`x${i}`));
      }

      const { deleted } = await adapter.deleteByPrefix('cap/', { limit: 2 });

      expect(deleted).toBe(2);
      expect((await adapter.list({ prefix: 'cap/' })).files).toHaveLength(3);
    });

    it('is idempotent: re-running returns deleted: 0', async () => {
      await adapter.upload('again/a.txt', Buffer.from('a'));
      await adapter.upload('again/b.txt', Buffer.from('b'));

      const first = await adapter.deleteByPrefix('again/');
      const second = await adapter.deleteByPrefix('again/');

      expect(first.deleted).toBe(2);
      expect(second.deleted).toBe(0);
    });

    it('round-trips list().key through delete() under a basePath', async () => {
      const scoped = new VercelBlobAdapter({ token: TOKEN, basePath: 'tenant-a' });
      try {
        await scoped.upload('scoped/a.txt', Buffer.from('a'));
        await scoped.upload('scoped/b.txt', Buffer.from('b'));

        const { deleted } = await scoped.deleteByPrefix('scoped/');

        expect(deleted).toBe(2);
        expect((await scoped.list({ prefix: 'scoped/' })).files).toHaveLength(0);
      } finally {
        await clearAll(scoped);
      }
    });

    // Guard tests verify the input checks fire before any SDK call — the tight
    // regex anchored on the guard message rules out any other downstream error.
    it.each([
      ['empty', ''],
      ['slash', '/'],
      ['dot', '.'],
      ['dot-slash', './'],
      ['dot-dot', '..'],
      ['foo/..', 'foo/..'],
    ])('rejects %s as prefix', async (_label, prefix) => {
      await expect(adapter.deleteByPrefix(prefix)).rejects.toThrow(
        /deleteByPrefix requires a non-empty prefix/,
      );
    });

    it.each([
      ['zero', 0],
      ['negative', -1],
      ['fractional', 0.5],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('rejects batch = %s', async (_label, batch) => {
      await expect(adapter.deleteByPrefix('foo/', { batch })).rejects.toThrow(
        /deleteByPrefix batch must be a positive integer/,
      );
    });

    it.each([
      ['negative', -1],
      ['fractional', 1.5],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('rejects limit = %s', async (_label, limit) => {
      await expect(adapter.deleteByPrefix('foo/', { limit })).rejects.toThrow(
        /deleteByPrefix limit must be a non-negative integer/,
      );
    });
  });
});
