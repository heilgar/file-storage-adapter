import { createAdapter, getAdapterName } from '../../../lib/adapters';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let adapterName: string | undefined;
  let key: string | null = null;
  try {
    const url = new URL(request.url);
    adapterName = getAdapterName(url.searchParams.get('adapter') || 'fs');
    key = url.searchParams.get('key');

    if (!key) {
      return Response.json({ error: 'key is required' }, { status: 400 });
    }

    const adapter = createAdapter(adapterName);
    const file = await adapter.download(key);
    const safeName = file.name.replace(/[\\/"]/g, '_');

    return new Response(file.content, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'X-File-Name': encodeURIComponent(file.name),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Download failed';
    console.error('download failed', { error, adapter: adapterName, key });
    return Response.json({ error: message }, { status: 500 });
  }
}
