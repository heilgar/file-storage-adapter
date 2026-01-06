import { createAdapter, getAdapterName } from '../../../lib/adapters';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let adapterName: string | undefined;
  let sourceKey: string | undefined;
  let destinationKey: string | undefined;
  try {
    const body = (await request.json()) as {
      adapter?: string;
      sourceKey?: string;
      destinationKey?: string;
    };

    adapterName = getAdapterName(body.adapter ?? 'fs');
    sourceKey = body.sourceKey?.trim();
    destinationKey = body.destinationKey?.trim();

    if (!sourceKey || !destinationKey) {
      return Response.json({ error: 'sourceKey and destinationKey are required' }, { status: 400 });
    }

    const adapter = createAdapter(adapterName);
    const metadata = await adapter.copy(sourceKey, destinationKey);

    return Response.json({ metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Copy failed';
    console.error('copy failed', { error, adapter: adapterName, sourceKey, destinationKey });
    return Response.json({ error: message }, { status: 500 });
  }
}
