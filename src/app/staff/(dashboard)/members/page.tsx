import MemberList from "@/components/staff/MemberList";
import PageHeader from "@/components/staff/PageHeader";
import { requireStaffPage } from "@/lib/staff/page-guard";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  await requireStaffPage();
  const members = await (await getStore()).listMembers();
  const live = members.filter((m) => m.endedAt === null).length;

  return (
    <>
      <PageHeader
        kicker="Membership"
        title={`${live} ${live === 1 ? "member" : "members"}`}
        copy="Who does not pay per class. A member proves it at booking with their number or the phone here, so both have to be right."
      />
      <div className="mt-10">
        <MemberList members={members} />
      </div>
    </>
  );
}
