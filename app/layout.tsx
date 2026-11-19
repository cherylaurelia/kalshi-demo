import type { Metadata } from "next";
import { Archivo_Narrow, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const archivo = Archivo_Narrow({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Kalshi Weather Index: station feed health behind hourly settlements (unofficial)",
  description:
    "An audit of the public Kalshi Weather Index API: which NYC and Chicago settlements used a METAR fallback, and how old it was. Unofficial, by Cheryl Aurelia.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
