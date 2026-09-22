import FacilityEditor from "@/components/staff/FacilityEditor";
import PageHeader from "@/components/staff/PageHeader";
import { getEditableFacilities } from "@/lib/content";
import { facilities as codeFacilities } from "@/lib/site";
import { requireAdminPage } from "@/lib/staff/page-guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Facilities" };

export default async function FacilitiesPage() {
  await requireAdminPage();
  const facilities = await getEditableFacilities();
  const fallbacks = codeFacilities.map((f) => f.image.src);

  return (
    <>
      <PageHeader
        kicker="The building"
        title={`${facilities.length} ${facilities.length === 1 ? "facility" : "facilities"}`}
        copy="The cards under “Every corner is made to move”. Order here is order on the site."
      />
      <div className="mt-10">
        <FacilityEditor facilities={facilities} fallbacks={fallbacks} />
      </div>
    </>
  );
}
