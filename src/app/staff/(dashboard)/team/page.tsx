import PageHeader from "@/components/staff/PageHeader";
import TeamManager from "@/components/staff/TeamManager";
import { requireAdminPage } from "@/lib/staff/page-guard";
import { getStore } from "@/lib/store";

// Accounts change; never serve a cached list.
export const dynamic = "force-dynamic";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const self = await requireAdminPage();

  const members = (await (await getStore()).listStaffUsers()).map((u) => ({
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));

  const admins = members.filter((m) => m.role === "admin").length;

  return (
    <>
      <PageHeader
        kicker="Access"
        title={`${members.length} ${members.length === 1 ? "account" : "accounts"}`}
        copy={`Who can sign in, and what they are allowed to do. ${admins} of them ${admins === 1 ? "is an admin" : "are admins"}.`}
      />
      <div className="mt-10">
        <TeamManager members={members} me={self.username} />
      </div>
    </>
  );
}
