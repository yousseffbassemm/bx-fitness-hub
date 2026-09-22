import { report } from "./report";

/**
 * Telling somebody at BX that an enquiry has arrived.
 *
 * The enquiry itself is already safe in the database before this runs - the
 * whole point of that change was that nothing depends on a message being
 * delivered. This is the nudge on top, so nobody has to remember to open a
 * screen.
 *
 * Inert until NOTIFY_EMAIL_TO and a provider key are set. A half-configured
 * notifier that throws would take the enquiry form down with it, which is
 * precisely the failure it exists to prevent, so every path here either
 * sends or returns quietly.
 *
 * Resend is the provider because it needs one key and no SDK. Any HTTP
 * provider fits the same shape; see sendEmail below.
 */

type Enquiry = {
  name: string;
  phone: string;
  email: string;
  goal: string;
};

export function notifyConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL_TO);
}

async function sendEmail(subject: string, text: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  // A verified sender at the gym's own domain; Resend rejects anything else.
  const from = process.env.NOTIFY_EMAIL_FROM ?? "BX Fitness Hub <onboarding@resend.dev>";

  if (!key || !to) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: to.split(",").map((a) => a.trim()),
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend refused it: ${res.status} ${await res.text()}`);
  }
  return true;
}

/**
 * Send it, but never let sending fail the thing that triggered it.
 *
 * Called without awaiting from the request path, so a slow provider does not
 * hold up the answer to the person who filled the form in.
 */
export async function notifyNewEnquiry(lead: Enquiry) {
  if (!notifyConfigured()) return;

  try {
    await sendEmail(
      `New enquiry: ${lead.name}`,
      [
        `${lead.name} asked to be contacted.`,
        "",
        `Goal:   ${lead.goal}`,
        `Phone:  ${lead.phone}`,
        `Email:  ${lead.email}`,
        "",
        "They are on the Enquiries screen in the staff area, where you can",
        "mark them done once you have spoken to them.",
      ].join("\n"),
      // So hitting reply in the inbox goes to the person who asked.
      lead.email,
    );
  } catch (error) {
    // The enquiry is already saved; this is the nudge failing, not the form.
    await report("notify new enquiry", error);
  }
}

/** Someone moved off the waitlist into a real place. */
export async function notifyPromoted(name: string, phone: string, when: string) {
  if (!notifyConfigured()) return;

  try {
    await sendEmail(
      `A place came free: call ${name}`,
      [
        `${name} was on the waitlist and now has a place.`,
        "",
        `Class:  ${when}`,
        `Phone:  ${phone}`,
        "",
        "They do not know yet. The Bookings screen lists them until",
        "somebody marks them as told.",
      ].join("\n"),
    );
  } catch (error) {
    await report("notify promoted", error);
  }
}
