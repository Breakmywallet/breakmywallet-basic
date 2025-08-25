import './globals.css';
export const metadata = {
  title: "BreakMyWallet — Real Builds. Real Costs.",
  description: "Car builds, dyno days, parts that slap, and what it all actually costs."
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
