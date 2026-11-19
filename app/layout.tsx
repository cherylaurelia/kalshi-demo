import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Kalshi Weather Index: station feed health behind hourly settlements (unofficial)",
  description:
    "An audit of the public Kalshi Weather Index API: which NYC and Chicago settlements used a METAR fallback, and how old it was. Unofficial, by Cheryl Aurelia.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
