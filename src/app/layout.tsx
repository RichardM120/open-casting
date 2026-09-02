import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";

import { PrelaunchBanner } from "@/components/prelaunch-banner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Open Casting",
    template: "%s | Open Casting",
  },
  description:
    "The private tool a casting call uses to run its casting. Post the roles, send one link, and read every submission in one place.",
};

/**
 * The document only. The site's header and footer belong to the (site) group,
 * and the applicant's pages under /c have a layout of their own with neither:
 * an applicant holds one link and there is nothing else for them to go to.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is rendered per request, never prerendered: the Content
  // Security Policy carries a nonce minted per request, and a page built once
  // at deploy time would ship scripts without it, which the policy then
  // blocks. The 404 page is the one that would otherwise go static.
  await connection();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <PrelaunchBanner />
        {children}
      </body>
    </html>
  );
}
