import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { isClerkConfigured } from "@/lib/mock/utils";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Office Store — Corporate Supply Management",
  description:
    "Cloud-native corporate office store management system for ordering office supplies, managing inventory, and tracking department budgets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkEnabled = isClerkConfigured();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <Providers clerkEnabled={clerkEnabled}>{children}</Providers>
      </body>
    </html>
  );
}
