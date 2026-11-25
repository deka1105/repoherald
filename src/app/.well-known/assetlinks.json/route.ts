/**
 * Android App Links: the Android counterpart of apple-app-site-association,
 * verifying that the app may open repoherald.com/repos/* and /lists/* (the
 * paths are declared in mobile/app.json's intentFilters, not here).
 *
 * A fingerprint is the SHA-256 of a certificate that signs the installed app.
 * The first is the EAS upload key, read from build 8 with `keytool -printcert`.
 * Once the app is on Google Play with Play App Signing, installs from the store
 * are signed by Google's key instead, so its fingerprint (Play Console → Test
 * and release → App integrity) has to be added here, or links will keep
 * opening in the browser for store installs.
 */
export const dynamic = "force-static";

const SHA256_CERT_FINGERPRINTS = [
  "0C:5E:FE:B4:B1:59:B0:24:0A:4E:7F:4E:75:FC:DE:20:D6:74:B9:11:75:81:4A:20:00:6E:5F:EB:ED:56:3B:C2",
];

export function GET() {
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.dekisuki05.repoherald",
        sha256_cert_fingerprints: SHA256_CERT_FINGERPRINTS,
      },
    },
  ]);
}
