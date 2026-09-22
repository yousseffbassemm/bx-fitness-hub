import LeadRowActions from "@/components/staff/LeadRowActions";
import PageHeader from "@/components/staff/PageHeader";
import { formatDate } from "@/lib/booking";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  const leads = await (await getStore()).listLeads();
  const waiting = leads.filter((l) => l.handledAt === null);

  return (
    <>
      <PageHeader
        kicker="Start here form"
        title={
          waiting.length > 0 ? (
            <>
              {waiting.length} waiting
              <span className="text-grey-dim"> of {leads.length}</span>
            </>
          ) : (
            `${leads.length} ${leads.length === 1 ? "enquiry" : "enquiries"}`
          )
        }
        copy="People who asked to be contacted. Newest first. Mark one done once you have spoken to them."
      />

      {leads.length === 0 ? (
        <p className="mt-10 rounded-sm border border-dashed border-white/15 px-6 py-16 text-center text-sm text-grey-dim">
          Nobody has used the form yet. When they do, they appear here.
        </p>
      ) : (
        <ol className="mt-10 divide-y divide-white/8 overflow-hidden rounded-sm border border-white/10 bg-charcoal">
          {leads.map((lead) => {
            const done = lead.handledAt !== null;
            return (
              <li
                key={lead.id}
                className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${
                  done ? "bg-white/[0.02]" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-2.5 text-sm">
                    <span className={done ? "text-grey-dim" : "text-white"}>
                      {lead.name}
                    </span>
                    <span className="text-[0.68rem] tracking-[0.1em] text-grey-dim uppercase">
                      {lead.goal}
                    </span>
                    {done && (
                      <span className="text-[0.68rem] tracking-[0.1em] text-lime uppercase">
                        Done
                      </span>
                    )}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <a
                      href={`tel:${lead.phone.replace(/\s/g, "")}`}
                      className={`tabular-nums ${done ? "text-grey-dim" : "text-grey hover:text-lime"}`}
                    >
                      {lead.phone}
                    </a>
                    <a
                      href={`mailto:${lead.email}`}
                      className={`break-all ${done ? "text-grey-dim" : "text-grey hover:text-lime"}`}
                    >
                      {lead.email}
                    </a>
                  </p>
                  <p className="mt-1.5 text-xs text-grey-dim">
                    {formatDate(lead.createdAt.slice(0, 10))}
                  </p>
                </div>

                <LeadRowActions id={lead.id} handled={done} />
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
