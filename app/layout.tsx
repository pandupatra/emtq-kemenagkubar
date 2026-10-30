import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://www.lptqkubar.id"),
  icons: { icon: "/logo-lptq.png", apple: "/logo-lptq.png" },
  title: "e-MTQ LPTQ Kubar",
  description:
    "Aplikasi e-MTQ LPTQ Kabupaten Kutai Barat untuk pengelolaan peserta, undian maqro, dan hasil undian MTQ.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "LPTQ Kubar",
    title: "e-MTQ LPTQ Kubar",
    description:
      "Kelola peserta, undian maqro, dan hasil undian MTQ Kabupaten Kutai Barat melalui e-MTQ LPTQ Kubar.",
    images: [
      {
        url: "/logo-lptq.png",
        alt: "Logo LPTQ Kabupaten Kutai Barat",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "e-MTQ LPTQ Kubar",
    description:
      "Kelola peserta, undian maqro, dan hasil undian MTQ Kabupaten Kutai Barat melalui e-MTQ LPTQ Kubar.",
    images: ["/logo-lptq.png"],
  },
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
