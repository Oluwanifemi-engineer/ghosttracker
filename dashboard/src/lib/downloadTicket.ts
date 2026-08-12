/**
 * APK download-ticket helpers (see /apk/download in the server).
 *
 * Tickets are short-lived (10-minute TTL) HMAC-signed URLs minted by
 * /apk/ticket. The download page pre-mints one for the button's href, so it
 * must be kept fresh — these pure helpers decide which URL is safe to use.
 */

export function ticketIsValid(url: string | null): boolean {
  if (!url) return false;
  try {
    const expires = new URL(url).searchParams.get('expires');
    return expires !== null && Number(expires) * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Always prefer a freshly minted ticket; fall back to the pre-minted href
 * ONLY while it is still unexpired, so a transient re-mint failure never
 * dead-ends the user on the server's 403 "Missing or expired download
 * ticket" page.
 */
export function pickDownloadUrl(freshUrl: string | null, currentHref: string | null): string | null {
  if (freshUrl) return freshUrl;
  return ticketIsValid(currentHref) ? currentHref : null;
}
