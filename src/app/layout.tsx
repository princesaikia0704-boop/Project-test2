import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var theme = localStorage.getItem('app_theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else if (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                var accent = localStorage.getItem('app_accent') || 'indigo';
                document.documentElement.setAttribute('data-accent', accent);
                var compact = localStorage.getItem('app_compact');
                if (compact === 'true') {
                  document.documentElement.setAttribute('data-compact', 'true');
                } else {
                  document.documentElement.removeAttribute('data-compact');
                }
              } catch (_) {}
            })();`,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
