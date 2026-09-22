import ClearErrors from "@/components/staff/ClearErrors";
import PageHeader from "@/components/staff/PageHeader";
import { requireAdminPage } from "@/lib/staff/page-guard";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Problems" };

function ago(at: string) {
  const then = new Date(at.replace(" ", "T") + (at.includes("Z") ? "" : "Z"));
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (Number.isNaN(mins)) return at;
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default async function ErrorsPage() {
  await requireAdminPage();
  const errors = await (await getStore()).listErrors();

  return (
    <>
      <PageHeader
        kicker="Server"
        title={
          errors.length === 0
            ? "Nothing has gone wrong"
            : `${errors.length} ${errors.length === 1 ? "problem" : "problems"}`
        }
        copy="Failures on the server, grouped. Somebody booking and getting an error lands here, whether or not they told you."
        actions={errors.length > 0 ? <ClearErrors /> : undefined}
      />

      {errors.length === 0 ? (
        <p className="mt-10 rounded-sm border border-dashed border-white/15 px-6 py-16 text-center text-sm text-grey-dim">
          Nothing to report. This page fills itself when something breaks.
        </p>
      ) : (
        <ul className="mt-10 space-y-3">
          {errors.map((e) => (
            <li
              key={e.id}
              className="rounded-sm border border-pink/30 bg-pink/[0.04] p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <code className="text-[0.72rem] tracking-wide text-grey">{e.where}</code>
                <span className="text-xs text-grey-dim">
                  {e.count > 1 && (
                    <span className="mr-3 text-pink">{e.count} times</span>
                  )}
                  {ago(e.at)}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-white">{e.message}</p>

              {e.detail && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-grey-dim hover:text-white">
                    Detail
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-sm bg-ink/70 p-3 text-[0.68rem] leading-relaxed text-grey-dim">
                    {e.detail}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
