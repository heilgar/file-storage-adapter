import { createAdapter, getAdapterName } from '../../../lib/adapters';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let adapterName: string | undefined;
  try {
    const url = new URL(request.url);
    adapterName = getAdapterName(url.searchParams.get('adapter') || 'fs');
    const prefix = url.searchParams.get('prefix') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const adapter = createAdapter(adapterName);
    const result = await adapter.list({
      prefix,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'List failed';
    console.error('list failed', { error, adapter: adapterName });
    return Response.json({ error: message }, { status: 500 });
  }
}
