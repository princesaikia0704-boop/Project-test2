import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
                var brandColor = localStorage.getItem('app_primary_color');
                if (brandColor && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(brandColor)) {
                  var clean = brandColor.replace('#', '');
                  if (clean.length === 3) clean = clean.split('').map(function(c) { return c + c; }).join('');
                  var bi = parseInt(clean, 16);
                  if (!isNaN(bi)) {
                    var rgb = ((bi >> 16) & 255) + ' ' + ((bi >> 8) & 255) + ' ' + (bi & 255);
                    document.documentElement.style.setProperty('--accent-500', rgb);
                    document.documentElement.style.setProperty('--accent-600', rgb);
                    document.documentElement.style.setProperty('--accent-700', rgb);
                    document.documentElement.setAttribute('data-accent', 'custom');
                  }
                } else {
                  var accent = localStorage.getItem('app_accent') || 'indigo';
                  document.documentElement.setAttribute('data-accent', accent);
                }
                var brandName = localStorage.getItem('app_company_name');
                if (brandName) {
                  document.title = brandName + ' — Corporate Supply Management';
                }
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
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
