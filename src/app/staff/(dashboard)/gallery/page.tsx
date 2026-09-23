import GalleryEditor from "@/components/staff/GalleryEditor";
import PageHeader from "@/components/staff/PageHeader";
import { getEditableGallery } from "@/lib/content";
import { gallery as codeGallery } from "@/lib/site";
import { requireAdminPage } from "@/lib/staff/page-guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  await requireAdminPage();
  const items = await getEditableGallery();
  // By description, not by position - see the note on the facilities screen.
  const fallbacks = Object.fromEntries(codeGallery.map((g) => [g.alt, g.src.src]));

  return (
    <>
      <PageHeader
        kicker="Inside BX"
        title={`${items.length} ${items.length === 1 ? "photo" : "photos"}`}
        copy="The mosaic near the bottom of the page."
      />
      <div className="mt-10">
        <GalleryEditor items={items} fallbacks={fallbacks} />
      </div>
    </>
  );
}
