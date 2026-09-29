/**
 * Remembers that /einkaufen was entered from inside Kinboard, and from where.
 *
 * /einkaufen hides its "back" link when it runs as an installed app, because
 * there it is the shopping PWA's own start_url and leaving its scope strands
 * the user in the main app. But `display-mode` cannot tell *which* installed
 * app it is running in. A wall tablet running the main Kinboard PWA, or a
 * kiosk browser in fullscreen, matches just the same — and following the
 * "Einkaufs-App" button there opened a page with no back link, no navigation
 * and no browser chrome: the only way out was killing the browser
 * (discussion #289).
 *
 * sessionStorage draws exactly the line needed. It is per tab and survives a
 * full document load within that tab, so the buttons that link here (plain
 * <a> tags, deliberately) can leave a note that the page reads on arrival.
 * A launch of the installed shopping app is a fresh browsing context with
 * nothing in it, so there the back link stays hidden as before.
 */

const KEY = "kinboard-einkaufen-entered-from";

/** Call from the click handler of any in-app link to /einkaufen. */
export function markEinkaufenEntry(): void {
  try {
    sessionStorage.setItem(KEY, window.location.pathname);
  } catch {
    // Storage blocked: the link still works, it just can't offer a way back
    // in an installed window.
  }
}

/**
 * The same-origin path /einkaufen was entered from, or null when it was
 * launched directly (installed shopping app, push notification, typed URL).
 */
export function readEinkaufenEntry(): string | null {
  try {
    const from = sessionStorage.getItem(KEY);
    // Only ever a path we wrote ourselves, but it becomes an href: refuse
    // anything that isn't plainly same-origin, and a loop back to itself.
    if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
    if (from.startsWith("/einkaufen")) return null;
    return from;
  } catch {
    return null;
  }
}
