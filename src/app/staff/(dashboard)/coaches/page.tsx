import CoachEditor from "@/components/staff/CoachEditor";
import PageHeader from "@/components/staff/PageHeader";
import { getEditableCoaches } from "@/lib/content";
import { coaches as codeCoaches } from "@/lib/site";
import { requireAdminPage } from "@/lib/staff/page-guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coaches" };

export default async function CoachesPage() {
  await requireAdminPage();
  const coaches = await getEditableCoaches();

  /*
    The photographs that ship in the code, so a coach who has never had one
    uploaded still shows the picture the site is currently using.

    Keyed by the name in the code, and looked up by the row's `base` rather
    than by whatever the name has been edited to. Keyed by the live name, a
    coach whose name was being corrected lost their portrait mid-edit and
    the card read "No photo", which looks like the photograph has just been
    deleted.
  */
  const fallbacks = Object.fromEntries(codeCoaches.map((c) => [c.name, c.photo.src]));

  return (
    <>
      <PageHeader
        kicker="Personal training"
        title={`${coaches.length} ${coaches.length === 1 ? "coach" : "coaches"}`}
        copy="The order here is the order on the site. Each portrait is cropped to a tall card - the buttons under it choose where."
      />
      <div className="mt-10">
        <CoachEditor coaches={coaches} fallbacks={fallbacks} />
      </div>
    </>
  );
}
