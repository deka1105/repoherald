/**
 * Universal Links for the iOS app: tells iOS that repoherald.com/repos/* and
 * /lists/* may open in the app instead of Safari.
 *
 * Only those two paths, on purpose. Those are the pages people share, and the
 * app has a native screen for each (mapped in mobile/src/app/+native-intent.tsx).
 * Claiming more — /wallet, /promote, the policy pages — would pull links into an
 * app that cannot show them, or that deliberately does not sell credits.
 *
 * Served by a route rather than from /public because the file has no extension,
 * and Apple's CDN expects `application/json`. The app id is the Team ID plus the
 * bundle id; both come from mobile/eas.json and mobile/app.json.
 */
export const dynamic = "force-static";

const APP_ID = "4LX3D498MB.com.dekisuki05.repoherald";

export function GET() {
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [APP_ID],
          components: [{ "/": "/repos/*" }, { "/": "/lists/*" }],
        },
      ],
    },
  });
}
