import { createAdapter, getAdapterName } from "../../../lib/adapters";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let adapterName: string | undefined;
  let key: string | undefined;
  try {
    const url = new URL(request.url);
    const form = await request.formData();
    const adapterParam = (form.get("adapter")?.toString() ?? url.searchParams.get("adapter")) || "fs";
    adapterName = getAdapterName(adapterParam);

    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    key = (form.get("key")?.toString() || file.name || "upload.bin").trim();
    if (!key) {
      return Response.json({ error: "key is required" }, { status: 400 });
    }

    const adapter = createAdapter(adapterName);
    const metadata = await adapter.upload(key, file, {
      contentType: file.type || undefined,
      metadata: { key },
    });

    return Response.json({ metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("upload failed", { error, adapter: adapterName, key });
    return Response.json({ error: message }, { status: 500 });
  }
}
