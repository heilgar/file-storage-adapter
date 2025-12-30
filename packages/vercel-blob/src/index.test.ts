import { describe, expect, it, vi } from 'vitest';
import { VercelBlobAdapter } from './index';

vi.mock('@vercel/blob', () => ({
  head: vi.fn(),
  del: vi.fn(),
  put: vi.fn(),
  list: vi.fn(),
  copy: vi.fn(),
}));

const { head, del, put, list, copy } = await import('@vercel/blob');

describe('VercelBlobAdapter', () => {
  it('uses basePath once when downloading', async () => {
    head.mockResolvedValueOnce({
      contentType: 'text/plain',
      size: 2,
      uploadedAt: new Date().toISOString(),
      url: 'https://example.test/blob',
      pathname: 'base/file.txt',
    });

    head.mockResolvedValueOnce({
      contentType: 'text/plain',
      size: 2,
      uploadedAt: new Date().toISOString(),
      url: 'https://example.test/blob',
      pathname: 'base/file.txt',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        arrayBuffer: async () => Uint8Array.from([1, 2]).buffer,
      })),
    );

    const adapter = new VercelBlobAdapter({ token: 'token', basePath: 'base' });
    const metadataSpy = vi.spyOn(adapter, 'getMetadata');

    const result = await adapter.download('file.txt');

    expect(metadataSpy).toHaveBeenCalledWith('file.txt');
    expect(head).toHaveBeenNthCalledWith(1, 'base/file.txt', { token: 'token' });
    expect(head).toHaveBeenNthCalledWith(2, 'base/file.txt', { token: 'token' });
    expect(result.content).toEqual(Buffer.from([1, 2]));

    vi.unstubAllGlobals();
  });
});
