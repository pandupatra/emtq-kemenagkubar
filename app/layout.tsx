import type { Metadata } from "next";
import { Montserrat, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import MuiProvider from "./mui-provider";
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lptqkubar.id"),
  icons: { icon: "/logo-lptq.png", apple: "/logo-lptq.png" },
  title: "e-Maqro LPTQ Kubar",
  description:
    "Aplikasi e-Maqro LPTQ Kabupaten Kutai Barat untuk pengelolaan peserta, undian maqro, dan hasil undian MTQ.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "LPTQ Kubar",
    title: "e-Maqro LPTQ Kubar",
    description:
      "Kelola peserta, undian maqro, dan hasil undian MTQ Kabupaten Kutai Barat melalui e-Maqro LPTQ Kubar.",
    images: [
      {
        url: "/logo-lptq.png",
        alt: "Logo LPTQ Kabupaten Kutai Barat",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "e-Maqro LPTQ Kubar",
    description:
      "Kelola peserta, undian maqro, dan hasil undian MTQ Kabupaten Kutai Barat melalui e-Maqro LPTQ Kubar.",
    images: ["/logo-lptq.png"],
  },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <body>
        <MuiProvider>{children}</MuiProvider>
      </body>
    </html>
  );
}
