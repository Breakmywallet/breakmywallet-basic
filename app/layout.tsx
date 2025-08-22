import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://breakmywallet.com"),
  title: "BreakMyWallet — Real Builds. Real Costs.",
  description: "BreakMyWallet: car builds, dyno days, parts that slap, and what it all actually costs.",
  openGraph: {
    title: "BreakMyWallet",
    description: "Real builds. Real costs. Zero fluff.",
    url: "https://breakmywallet.com",
    siteName: "BreakMyWallet",
    images: ["/og.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BreakMyWallet",
    description: "Real builds. Real costs.",
    images: ["/og.jpg"],
  },
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}