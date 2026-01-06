import { createAdapter, getAdapterName } from '../../../lib/adapters';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
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
    const ok = await adapter.delete(key);

    return Response.json({ ok });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    console.error('delete failed', { error, adapter: adapterName, key });
    return Response.json({ error: message }, { status: 500 });
  }
}
