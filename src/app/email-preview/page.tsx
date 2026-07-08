import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  SPONSOR_ALERT_TEMPLATES,
  DEFAULT_SPONSOR_ALERT_TEMPLATE_ID,
  type SponsorAlertData,
} from "@/lib/email-templates";

// Standalone admin-only preview of the sponsored-repo alert emails. Lives as a
// top-level route (not under /admin) so it doesn't depend on the admin route
// group; it enforces the same admin check inline.

const SAMPLE: SponsorAlertData = {
  fullName: "acme/rocket",
  description:
    "A blazing-fast toolkit for building and shipping web apps — batteries included, zero config.",
  primaryLanguage: "TypeScript",
  starsCount: 1284,
  avatarUrl: "https://avatars.githubusercontent.com/u/6154722?s=200&v=4",
  repoUrl: "https://repoherald.vercel.app/repos/sample",
};

export const metadata = { title: "Alert email preview · repoherald" };

export default async function EmailPreviewPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 20px 64px",
        fontFamily:
          "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>
        Sponsored-repo alert emails
      </h1>
      <p style={{ color: "#666", fontSize: 14, margin: "0 0 32px", lineHeight: 1.5 }}>
        The designs sent to opted-in users when a sponsored repo goes live,
        rendered with sample data. The one marked <b>Sending</b> is what production
        currently uses — change <code>DEFAULT_SPONSOR_ALERT_TEMPLATE_ID</code> in{" "}
        <code>src/lib/email-templates.ts</code> to switch.
      </p>

      {SPONSOR_ALERT_TEMPLATES.map((t) => {
        const { subject, html } = t.render(SAMPLE);
        const isDefault = t.id === DEFAULT_SPONSOR_ALERT_TEMPLATE_ID;
        return (
          <section key={t.id} style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>{t.name}</h2>
              {isDefault && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#111",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  Sending
                </span>
              )}
              <span style={{ fontSize: 12, color: "#888" }}>{t.blurb}</span>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <div
                style={{
                  borderBottom: "1px solid #e5e7eb",
                  background: "#f7f7f8",
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#888" }}>Subject: </span>
                <b>{subject}</b>
              </div>
              <iframe
                title={`${t.name} preview`}
                srcDoc={html}
                sandbox=""
                style={{ width: "100%", height: 440, border: "none", background: "#fff" }}
              />
            </div>
          </section>
        );
      })}
    </main>
  );
}
