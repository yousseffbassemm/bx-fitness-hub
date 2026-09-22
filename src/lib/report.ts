import { getStore } from "./store";

/**
 * Record a server-side failure so somebody finds out about it.
 *
 * The alternative on this project was console.error into a log file that the
 * watchdog truncates on every restart - which is how the enquiry form came to
 * be dropping people's details in silence. Failures go in the database, next
 * to everything else, and surface on a staff screen.
 *
 * Never throws. A reporting path that can fail is a second bug hiding the
 * first, and this is called from catch blocks whose job is to keep the site
 * answering.
 */
export async function report(where: string, error: unknown, detail?: string) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  // Still write it to the server log: the database may be the thing that broke.
  console.error(`[bx] ${where}: ${message}`);

  try {
    const stack = error instanceof Error ? error.stack : undefined;
    await (await getStore()).recordError(where, message, detail ?? stack);
  } catch {
    // Nothing more to be done - the log line above is the fallback.
  }
}
