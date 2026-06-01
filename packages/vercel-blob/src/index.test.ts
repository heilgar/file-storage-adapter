import { describe, expect, it, vi } from 'vitest';
import { VercelBlobAdapter } from './index';

vi.mock('@vercel/blob', () => ({
  head: vi.fn(),
  del: vi.fn(),
  put: vi.fn(),
  list: vi.fn(),
  copy: vi.fn(),
  get: vi.fn(),
  issueSignedToken: vi.fn(),
  presignUrl: vi.fn(),
}));

const { head, put, get, copy, issueSignedToken, presignUrl } = await import('@vercel/blob');

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

  it('uploads with access from config (private)', async () => {
    put.mockResolvedValueOnce({
      url: 'https://store.private.blob.vercel-storage.com/file.txt',
      pathname: 'file.txt',
      contentType: 'text/plain',
      contentDisposition: 'attachment; filename="file.txt"',
    });

    const adapter = new VercelBlobAdapter({ token: 'token', access: 'private' });
    await adapter.upload('file.txt', Buffer.from('hi'));

    expect(put).toHaveBeenCalledWith(
      'file.txt',
      Buffer.from('hi'),
      expect.objectContaining({ access: 'private', token: 'token' }),
    );
  });

  it('downloads private blobs via get() stream', async () => {
    head.mockResolvedValueOnce({
      contentType: 'text/plain',
      size: 2,
      uploadedAt: new Date().toISOString(),
      url: 'https://store.private.blob.vercel-storage.com/file.txt',
      pathname: 'file.txt',
    });

    get.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Response(Uint8Array.from([1, 2])).body,
      headers: new Headers(),
      blob: { contentType: 'text/plain', size: 2 },
    });

    const adapter = new VercelBlobAdapter({ token: 'token', access: 'private' });
    const result = await adapter.download('file.txt');

    expect(get).toHaveBeenCalledWith('file.txt', { access: 'private', token: 'token' });
    expect(result.content).toEqual(Buffer.from([1, 2]));
  });

  it('returns presigned URL for private getSignedUrl', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const expectedValidUntil = Date.now() + 60 * 1000;

    issueSignedToken.mockResolvedValueOnce({
      delegationToken: 'dt',
      clientSigningToken: 'cst',
      validUntil: expectedValidUntil,
    });
    presignUrl.mockResolvedValueOnce({ presignedUrl: 'https://signed.example/file.txt' });

    const adapter = new VercelBlobAdapter({ token: 'token', access: 'private' });
    const url = await adapter.getSignedUrl('file.txt', { expiresIn: 60 });

    expect(issueSignedToken).toHaveBeenCalledWith({
      pathname: 'file.txt',
      operations: ['get'],
      validUntil: expectedValidUntil,
      token: 'token',
    });
    expect(presignUrl).toHaveBeenCalledWith(
      { delegationToken: 'dt', clientSigningToken: 'cst', validUntil: expectedValidUntil },
      {
        operation: 'get',
        pathname: 'file.txt',
        access: 'private',
        validUntil: expectedValidUntil,
      },
    );
    expect(url).toBe('https://signed.example/file.txt');

    vi.useRealTimers();
  });

  it('returns presigned upload URL for private getSignedUrlUpload', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const expectedValidUntil = Date.now() + 60 * 1000;

    issueSignedToken.mockResolvedValueOnce({
      delegationToken: 'dt',
      clientSigningToken: 'cst',
      validUntil: expectedValidUntil,
    });
    presignUrl.mockResolvedValueOnce({ presignedUrl: 'https://signed.example/put/file.txt' });

    const adapter = new VercelBlobAdapter({ token: 'token', access: 'private' });
    const result = await adapter.getSignedUrlUpload('file.txt', {
      expiresIn: 60,
      contentType: 'image/png',
    });

    expect(issueSignedToken).toHaveBeenCalledWith({
      pathname: 'file.txt',
      operations: ['put'],
      validUntil: expectedValidUntil,
      allowedContentTypes: ['image/png'],
      token: 'token',
    });
    expect(presignUrl).toHaveBeenCalledWith(
      { delegationToken: 'dt', clientSigningToken: 'cst', validUntil: expectedValidUntil },
      {
        operation: 'put',
        pathname: 'file.txt',
        access: 'private',
        validUntil: expectedValidUntil,
        allowedContentTypes: ['image/png'],
      },
    );
    expect(result).toEqual({
      url: 'https://signed.example/put/file.txt',
      headers: { 'Content-Type': 'image/png' },
    });
  });

  it('throws on getSignedUrlUpload for public access', async () => {
    const adapter = new VercelBlobAdapter({ token: 'token' });
    await expect(adapter.getSignedUrlUpload('file.txt', { expiresIn: 60 })).rejects.toThrow(
      /Signed upload URLs are not supported for public/,
    );
  });

  it('copies with access from config (private)', async () => {
    copy.mockResolvedValueOnce({});
    head.mockResolvedValueOnce({
      contentType: 'text/plain',
      size: 2,
      uploadedAt: new Date().toISOString(),
      url: 'https://store.private.blob.vercel-storage.com/b.txt',
      pathname: 'b.txt',
    });

    const adapter = new VercelBlobAdapter({ token: 'token', access: 'private' });
    await adapter.copy('a.txt', 'b.txt');

    expect(copy).toHaveBeenCalledWith(
      'a.txt',
      'b.txt',
      expect.objectContaining({ access: 'private', token: 'token' }),
    );
  });
});
