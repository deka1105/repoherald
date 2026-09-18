import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { StorageNotice } from "@/components/storage-notice";
import { ThemeProvider } from "@/components/theme-provider";
import { PageTracker } from "@/components/page-tracker";
import { GithubClickTracker } from "@/components/github-click-tracker";
import { themeInitScript } from "@/lib/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://repoherald.com";

const DESCRIPTION =
  "Post your repos, earn highlight time for the repos you star, and discover what's worth starring.";

export const metadata: Metadata = {
  // Canonical origin for link previews: without it, Open Graph image URLs stay
  // relative and X/Slack/Discord can't resolve them.
  metadataBase: new URL(SITE_URL),
  title: "repoherald",
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "repoherald", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "repoherald",
    title: "repoherald",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: "repoherald", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Extend content under the notch/home-indicator; components add safe-area
  // padding where they touch the edges.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the themeInitScript mutates <html> classes and
    // data-theme before hydration, so its attributes intentionally differ from
    // the server-rendered default.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
          <StorageNotice />
        </ThemeProvider>
        <PageTracker />
        <GithubClickTracker />
      </body>
    </html>
  );
}
