import { report } from "@/lib/report";
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

  /*
    A store that cannot be reached threw out of here, which Next answers
    with 500 and an HTML error page - served under an image's URL, into an
    <img> tag. 503 keeps it an image request that failed, and leaves the
    page around it intact.
  */
  let file;
  try {
    file = await (await getStore()).getUpload(id);
  } catch (error) {
    // The id goes in the detail, not the label: one row per broken
    // photo would bury the Errors screen during an outage.
    await report("GET /api/photo", error, id);
    return new Response("Unavailable", { status: 503 });
  }
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
