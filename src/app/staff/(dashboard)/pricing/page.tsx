import PageHeader from "@/components/staff/PageHeader";
import PlanEditor from "@/components/staff/PlanEditor";
import { defaultPlanValues, getEditablePlans } from "@/lib/content";
import { requireAdminPage } from "@/lib/staff/page-guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  await requireAdminPage();
  const plans = await getEditablePlans();

  return (
    <>
      <PageHeader
        kicker="Membership"
        title="Pricing"
        copy="What the three plans cost. Saving updates the site straight away."
      />
      <div className="mt-10">
        <PlanEditor plans={plans} defaults={defaultPlanValues()} />
      </div>
    </>
  );
}
