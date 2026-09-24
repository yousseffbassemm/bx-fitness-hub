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
  const lapsed = members.length - live;

  return (
    <>
      <PageHeader
        kicker="Membership"
        title={`${live} ${live === 1 ? "member" : "members"}`}
        /*
          The heading counts memberships that are running, because a lapsed
          one pays per class like anybody else. The lapsed rows stay in the
          list though, so the heading has to account for the difference -
          "3 members" above four rows reads as a bug to whoever is counting
          rows at the desk.
        */
        copy={`Who does not pay per class. A member proves it at booking with their number or the phone here, so both have to be right.${
          lapsed
            ? ` ${lapsed === 1 ? "One lapsed membership is" : `${lapsed} lapsed memberships are`} listed below but not counted here.`
            : ""
        }`}
      />
      <div className="mt-10">
        <MemberList members={members} />
      </div>
    </>
  );
}
