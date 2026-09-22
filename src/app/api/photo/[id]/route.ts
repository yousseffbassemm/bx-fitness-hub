import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Serves an uploaded image.
 *
 * The id is a hash of the file's contents, so a given URL can only ever
 * return one image and it is safe to cache forever. Changing a coach's
 * photograph produces a different id and therefore a different URL, which is
 * what makes the change appear immediately rather than after a cache expires.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^[a-f0-9]{16,64}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const file = await (await getStore()).getUpload(id);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
