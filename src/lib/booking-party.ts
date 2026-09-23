import type { PaymentMethod } from "@/lib/store/types";

import { getStore } from "@/lib/store";

/**
 * Who is taking this place: a member, or somebody off the street.
 *
 * Classes are open to both, and the two are not the same at the desk - a
 * member's place is part of what they already pay for, a guest pays for the
 * class. The booking has to say which, so this is the one place that
 * decides it, shared by booking and by joining the queue.
 *
 * The membership is always checked here, against the database, whatever the
 * browser claims. "I am a member" arriving in a request body is a claim, not
 * proof, and the desk would be the one to find out.
 */

const PHONE = /^[+\d][\d\s-]{8,17}$/;
const PAYMENTS: PaymentMethod[] = ["cash"];

export type Party =
  | {
      ok: true;
      name: string;
      phone: string;
      memberId: string | null;
      payment: PaymentMethod | null;
    }
  | { ok: false; status: number; error: string; reason?: string };

const no = (status: number, error: string, reason?: string): Party => ({
  ok: false,
  status,
  error,
  reason,
});

export async function resolveParty(body: Record<string, unknown>): Promise<Party> {
  const reference = typeof body.memberRef === "string" ? body.memberRef.trim() : "";

  if (body.member === true || reference) {
    if (!reference) {
      return no(400, "Give your membership number or the phone number we have for you.");
    }

    const found = await (await getStore()).findMember(reference);

    if (!found.found && found.reason === "ambiguous") {
      // Two memberships on one phone is a Couples & Friends plan, not a
      // mistake. Picking one of them would book the wrong person in.
      return no(
        409,
        "More than one membership uses that number. Please use your membership number.",
        "ambiguous-member",
      );
    }

    if (!found.found) {
      return no(
        404,
        "We cannot find that membership. Check the number, or book as a guest and the desk will sort it out.",
        "unknown-member",
      );
    }

    // The name and phone come from the membership, not from the browser, so
    // a class list reads as the people BX has on file.
    return {
      ok: true,
      name: found.member.name,
      phone: found.member.phone,
      memberId: found.member.id,
      payment: null,
    };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const payment = typeof body.payment === "string" ? body.payment.trim() : "";

  if (name.length < 2) return no(400, "Please give a name");
  // A ceiling, as the enquiry form has. Nothing legitimate is this long, and
  // without one the column takes whatever is sent.
  if (name.length > 80) return no(400, "That name is too long");
  if (!PHONE.test(phone)) return no(400, "Please give a valid phone number");

  if (!PAYMENTS.includes(payment as PaymentMethod)) {
    return no(400, "Please choose how you would like to pay");
  }

  return { ok: true, name, phone, memberId: null, payment: payment as PaymentMethod };
}
