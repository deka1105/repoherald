/**
 * Every URL the OS hands the app passes through here before expo-router
 * resolves it.
 *
 * Two jobs:
 *
 * 1. Universal / App Links. The website's paths are plural (`/repos/<id>`,
 *    `/lists/<slug>`) and the app's are singular (`/repo/[id]`,
 *    `/list/[slug]`), because the app's routes predate the links. Mapping here
 *    keeps both URL schemes as they are: renaming the app's routes would break
 *    every `repoherald://` link already handed out, and the website's paths are
 *    what Google has indexed.
 *
 * 2. The share extension. It opens the app with `repoherald://dataUrl=<key>`,
 *    which is not a route — the payload lives in the native module, read by
 *    `ShareIntentProvider`. Sending it to `/` lets the provider pick it up from
 *    a screen that always exists, instead of a +not-found.
 *
 * Must never throw: a failure here is a blank app. Anything unrecognised is
 * passed through unchanged for the router to handle (or 404) itself.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes("dataUrl=")) return "/";

    // `path` may arrive as a full https URL, a scheme URL or a bare path.
    let pathname = path;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
      const u = new URL(path);
      // repoherald://repo/x parses with host "repo" — fold it back into the path.
      pathname = u.protocol === "https:" || u.protocol === "http:"
        ? u.pathname
        : `/${u.host}${u.pathname}`;
    }

    const repo = pathname.match(/^\/repos\/([^/?#]+)\/?$/);
    if (repo) return `/repo/${repo[1]}`;
    const list = pathname.match(/^\/lists\/([^/?#]+)\/?$/);
    if (list) return `/list/${list[1]}`;

    return path;
  } catch {
    return "/";
  }
}
