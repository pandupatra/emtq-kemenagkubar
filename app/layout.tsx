import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/logo-lptq.png", apple: "/logo-lptq.png" },
  title: "e-MTQ LPTQ Kubar",
  description:
    "Daftar peserta, undian maqro, dan hasil undian MTQ Kutai Barat.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
