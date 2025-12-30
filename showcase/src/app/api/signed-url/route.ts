import { createAdapter, getAdapterName } from "../../../lib/adapters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let adapterName: string | undefined;
  let key: string | null = null;
  try {
    const url = new URL(request.url);
    adapterName = getAdapterName(url.searchParams.get("adapter") || "fs");
    key = url.searchParams.get("key");
    const expiresParam = url.searchParams.get("expiresIn");
    const expiresIn = expiresParam ? Number.parseInt(expiresParam, 10) : 60;

    if (!key) {
      return Response.json({ error: "key is required" }, { status: 400 });
    }

    const adapter = createAdapter(adapterName);
    const signedUrl = await adapter.getSignedUrl(key, {
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : 60,
    });

    return Response.json({ url: signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signed URL failed";
    console.error("signed url failed", { error, adapter: adapterName, key });
    return Response.json({ error: message }, { status: 500 });
  }
}
