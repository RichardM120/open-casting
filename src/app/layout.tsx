import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { PrelaunchBanner } from "@/components/prelaunch-banner";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/auth";

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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Lets a keyboard past the header, which otherwise has to be tabbed
            through on every page. Visible only once focused. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
        >
          Skip to content
        </a>
        <PrelaunchBanner />
        <SiteHeader user={user} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
