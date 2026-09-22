import PageHeader from "@/components/staff/PageHeader";
import ScheduleEditor from "@/components/staff/ScheduleEditor";
import { BOOKING_WINDOW_DAYS, toISODate } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { requireAdminPage } from "@/lib/staff/page-guard";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timetable" };

export default async function TimetablePage() {
  await requireAdminPage();

  const store = await getStore();
  const schedule = await getSchedule();
  const total = schedule.reduce((n, d) => n + d.sessions.length, 0);

  /*
    How many live bookings each class already has, so the editor can warn
    before someone changes a class people are expecting to attend. Counted
    over the same window people can book in.
  */
  const from = toISODate(new Date());
  const until = new Date();
  until.setDate(until.getDate() + BOOKING_WINDOW_DAYS);
  const booked: Record<string, number> = {};
  for (const row of await store.list(from, toISODate(until))) {
    if (row.cancelledAt !== null) continue;
    booked[row.sessionId] = (booked[row.sessionId] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader
        kicker="Classes"
        title={`${total} ${total === 1 ? "class" : "classes"} a week`}
        copy="Changing a class keeps the bookings on it. Removing one leaves those people booked on nothing, and they show at the top of Bookings."
      />
      <div className="mt-10">
        <ScheduleEditor schedule={schedule} bookedIds={booked} />
      </div>
    </>
  );
}
