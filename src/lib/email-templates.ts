// Sponsored-repo alert email templates. Each renders inline-styled, email-safe
// HTML (plus a plaintext fallback) from the same data shape, so notify.ts and
// the admin preview page share one source of truth. Swap DEFAULT_SPONSOR_ALERT
// to change which design actually gets sent.

export type SponsorAlertData = {
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  starsCount: number;
  avatarUrl: string | null;
  repoUrl: string;
  /** Per-recipient signed unsubscribe link. Optional so the admin preview can
   *  render without minting a real token; every sent email supplies it. */
  unsubscribeUrl?: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

export type SponsorAlertTemplate = {
  id: string;
  name: string;
  blurb: string;
  render: (d: SponsorAlertData) => RenderedEmail;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FOOTER =
  "You're receiving this because you turned on sponsored-repo alerts in your repoherald wallet, where you can turn them off any time.";

/** Footer HTML including a one-click unsubscribe link when we have one. */
function footerHtml(d: SponsorAlertData): string {
  if (!d.unsubscribeUrl) return esc(FOOTER);
  return `${esc(FOOTER)} <a href="${esc(d.unsubscribeUrl)}" style="color:inherit;">Unsubscribe</a>.`;
}

function footerText(d: SponsorAlertData): string {
  return d.unsubscribeUrl
    ? `${FOOTER}\nUnsubscribe: ${d.unsubscribeUrl}`
    : FOOTER;
}

function stars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function textBody(d: SponsorAlertData, lead: string): string {
  return `${lead}\n\n${d.fullName}${
    d.description ? `\n${d.description}` : ""
  }\n\nView & star it: ${d.repoUrl}\n\n—\n${footerText(d)}`;
}

/** 1) Minimal — plain, lots of whitespace, single link-style CTA. */
const minimal: SponsorAlertTemplate = {
  id: "minimal",
  name: "Minimal",
  blurb: "Plain and quiet — text-forward, one clear call to action.",
  render: (d) => ({
    subject: `New sponsored repo: ${d.fullName}`,
    html: `<div style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#888;margin:0 0 24px;">repoherald</p>
    <h1 style="font-size:20px;margin:0 0 4px;">A new sponsored repo just went live</h1>
    <p style="margin:0 0 20px;color:#444;">Someone put their project in front of the community — take a look and star it if it's useful.</p>
    <p style="margin:0 0 4px;font-size:17px;font-weight:600;">
      <a href="${d.repoUrl}" style="color:#111;text-decoration:none;">${esc(d.fullName)}</a>
    </p>
    ${d.description ? `<p style="margin:0 0 24px;color:#555;">${esc(d.description)}</p>` : ""}
    <p style="margin:0 0 32px;">
      <a href="${d.repoUrl}" style="color:#2563eb;font-weight:600;text-decoration:none;">View &amp; star it &rarr;</a>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:0 0 16px;" />
    <p style="font-size:12px;color:#aaa;margin:0;">${footerHtml(d)}</p>
  </div>
</div>`,
    text: textBody(d, "A new sponsored repo just went live on repoherald."),
  }),
};

/** 2) Card — repo avatar, star/language meta, bordered card, button CTA. */
const card: SponsorAlertTemplate = {
  id: "card",
  name: "Repo card",
  blurb: "Shows the repo like a feed card: avatar, stars, language, button.",
  render: (d) => ({
    subject: `${d.fullName} is now sponsored on repoherald`,
    html: `<div style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#8a8f98;margin:0 0 16px;text-align:center;">repoherald · new sponsored repo</p>
    <div style="background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
        <td style="width:48px;vertical-align:top;">
          <img src="${d.avatarUrl ?? ""}" width="40" height="40" alt="" style="border-radius:8px;display:block;background:#eee;" />
        </td>
        <td style="vertical-align:top;padding-left:12px;">
          <a href="${d.repoUrl}" style="font-size:17px;font-weight:700;color:#111;text-decoration:none;">${esc(d.fullName)}</a>
          <div style="margin-top:4px;font-size:13px;color:#6b7280;">
            ${d.primaryLanguage ? `<span>${esc(d.primaryLanguage)}</span>` : ""}
            ${d.primaryLanguage ? `<span style="margin:0 6px;">·</span>` : ""}
            <span>&#9733; ${stars(d.starsCount)} stars</span>
          </div>
        </td>
      </tr></table>
      ${d.description ? `<p style="margin:16px 0 0;color:#374151;font-size:14px;">${esc(d.description)}</p>` : ""}
      <a href="${d.repoUrl}" style="display:inline-block;margin-top:20px;background:#111;color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:10px 18px;border-radius:8px;">Star this repo</a>
    </div>
    <p style="font-size:12px;color:#9aa0a6;margin:16px 0 0;text-align:center;">${footerHtml(d)}</p>
  </div>
</div>`,
    text: textBody(d, `${d.fullName} is now sponsored on repoherald.`),
  }),
};

/** 3) Announcement — bold coloured header banner, punchy tone. */
const announcement: SponsorAlertTemplate = {
  id: "announcement",
  name: "Announcement",
  blurb: "Bold gradient header banner — feels like a launch shout-out.",
  render: (d) => ({
    subject: `⭐ Fresh sponsored repo: ${d.fullName}`,
    html: `<div style="margin:0;padding:0;background:#0b1020;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center;">
      <p style="margin:0;color:#e9e7ff;font-size:13px;letter-spacing:.08em;text-transform:uppercase;">repoherald</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">⭐ New sponsored repo</h1>
    </div>
    <div style="background:#12172b;padding:28px 24px;color:#d7dbe8;">
      <p style="margin:0 0 6px;font-size:19px;font-weight:700;">
        <a href="${d.repoUrl}" style="color:#fff;text-decoration:none;">${esc(d.fullName)}</a>
      </p>
      <p style="margin:0 0 18px;font-size:13px;color:#9aa2bd;">&#9733; ${stars(d.starsCount)} stars${
        d.primaryLanguage ? ` · ${esc(d.primaryLanguage)}` : ""
      }</p>
      ${d.description ? `<p style="margin:0 0 24px;color:#c3c9dc;">${esc(d.description)}</p>` : ""}
      <a href="${d.repoUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;">Check it out &rarr;</a>
    </div>
    <p style="font-size:12px;color:#6b7280;margin:0;padding:16px 24px 28px;text-align:center;">${footerHtml(d)}</p>
  </div>
</div>`,
    text: textBody(d, `New sponsored repo on repoherald — ${d.fullName}.`),
  }),
};

export const SPONSOR_ALERT_TEMPLATES: SponsorAlertTemplate[] = [
  minimal,
  card,
  announcement,
];

/** Which design notify.ts actually sends. */
export const DEFAULT_SPONSOR_ALERT_TEMPLATE_ID = "announcement";

export function renderSponsorAlert(
  data: SponsorAlertData,
  templateId: string = DEFAULT_SPONSOR_ALERT_TEMPLATE_ID
): RenderedEmail {
  const t =
    SPONSOR_ALERT_TEMPLATES.find((x) => x.id === templateId) ??
    SPONSOR_ALERT_TEMPLATES[0];
  return t.render(data);
}
