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

/** Sending is possible at all. Who it reaches is decided per message. */
export function notifyConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/** The BX inbox that gets told, if one is configured. */
const staffInbox = () => process.env.NOTIFY_EMAIL_TO?.trim() || null;

async function sendEmail(
  to: string | string[],
  subject: string,
  text: string,
  replyTo?: string,
) {
  const key = process.env.RESEND_API_KEY;
  /*
    The sender has to be an address at a domain verified with the provider.
    An invented one is refused outright - there is no way to send "from" a
    domain nobody has proved they own, which is the whole point of the check.
    Until BX has a domain and it is verified, this falls back to the
    provider's own sandbox sender, which works and looks like what it is.
  */
  const from = process.env.NOTIFY_EMAIL_FROM?.trim() || "BX Fitness Hub <onboarding@resend.dev>";

  if (!key) return false;
  const recipients = (Array.isArray(to) ? to : [to]).map((a) => a.trim()).filter(Boolean);
  if (!recipients.length) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
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

  /*
    Two different messages to two different people.

    The person who filled the form in gets a confirmation, because "we'll be
    in touch" on a screen they are about to close is not much of a promise -
    an email is something they can look back at, and it tells them the number
    BX will call.

    The gym gets the details, so nobody has to remember to open a screen.
  */
  try {
    await sendEmail(
      lead.email,
      "We've got your details - BX Fitness Hub",
      [
        `Hi ${lead.name.split(" ")[0]},`,
        "",
        "Thanks for getting in touch. Somebody from BX will call you on",
        `${lead.phone} about ${lead.goal.toLowerCase()}.`,
        "",
        "If you would rather not wait, the gym is on 010 4000 1413,",
        "open six in the morning until one at night, every day.",
        "",
        "BX Fitness Hub",
        "In front of Gate 6, Mivida, New Cairo",
      ].join("\n"),
    );
  } catch (error) {
    await report("confirm enquiry to sender", error);
  }

  const inbox = staffInbox();
  if (!inbox) return;

  try {
    await sendEmail(
      inbox.split(","),
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
  const inbox = staffInbox();
  // Bookings ask for a name and a phone number, not an email, so the member
  // cannot be told directly - somebody at the gym has to call them.
  if (!notifyConfigured() || !inbox) return;

  try {
    await sendEmail(
      inbox.split(","),
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
