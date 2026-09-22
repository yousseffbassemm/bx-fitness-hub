import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/staff/guard";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/** Generous for a portrait, small enough that a phone photo gets resized first. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * What the bytes actually are, rather than what the upload claims.
 *
 * A Content-Type header is whatever the client says it is. These are the
 * first few bytes of the file itself, so a script renamed to .jpg is refused
 * on what it contains rather than on what it is called.
 */
function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length > 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file in the upload." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That image is over ${MAX_BYTES / 1024 / 1024}MB. Try a smaller one.` },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);

  if (!mime) {
    return NextResponse.json(
      { error: "That is not a JPEG, PNG or WebP image." },
      { status: 415 },
    );
  }

  // Content hash: the same photograph uploaded twice is one row, and the URL
  // it produces can be cached forever because it cannot come to mean
  // something else.
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 32);

  await (await getStore()).saveUpload(id, mime, bytes);

  return NextResponse.json({ ok: true, id, url: `/api/photo/${id}` });
}
