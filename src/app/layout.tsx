import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = (await cookies()).get("apc_theme")?.value;
  return (
    <html
      lang="pt-BR"
      className={publicSans.variable}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
    >
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
