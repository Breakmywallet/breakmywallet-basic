'use client';

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { ArrowRight, ShoppingBag, Youtube, Instagram, Mail } from "lucide-react";

export default function Page() {
  return (
    <div id="home">
      <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10">
        <div className="container">
          <div className="flex h-16 items-center justify-between">
            <Link href="#home" className="flex items-center gap-3">
              <Image src="/logo-mark.svg" alt="BreakMyWallet" width={32} height={32} priority />
              <span className="font-extrabold tracking-tight text-lg">BreakMyWallet</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <a href="#social" className="link">Social</a>
              <a href="#shop" className="link">Shop</a>
              <a href="#contact" className="link">Contact</a>
            </nav>
            <a href="#shop" className="btn btn-primary"><ShoppingBag className="h-4 w-4" /> Shop</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0"
             style={{ background:
                "radial-gradient(1200px 600px at 20% -10%, rgba(18,164,255,.20), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(11,111,181,.25), transparent 50%)"
              }} />
        <div className="container py-20">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Image src="/logo-wordmark.svg" alt="BreakMyWallet" width={240} height={48} className="opacity-95" priority />
            <span className="text-sm text-zinc-400">Real builds. Real costs.</span>
          </div>

          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight leading-none">
            Build fast. Break parts. <span style={{ color: "var(--bmw-blue)" }}>Tell the truth.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-300">
            Garage-born media: dyno days, lap times, parts lists, and full receipts. No fluff.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="#social" className="btn btn-primary">Watch & Follow <ArrowRight className="h-4 w-4" /></a>
            <a href="#shop" className="btn btn-ghost">Latest Drops</a>
          </div>
        </div>
      </section>

      <section id="social" className="container py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">Latest from the Garage</h2>

        <Script src="https://snapwidget.com/js/snapwidget.js" strategy="afterInteractive" />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Instagram className="h-5 w-5" /> Instagram
            </h3>
            <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src="PASTE_YOUR_INSTAGRAM_WIDGET_SRC_HERE"
                className="w-full h-full"
                allowTransparency={true}
                scrolling="no"
                frameBorder="0"
                title="Instagram Feed"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">Tip: use LightWidget/SnapWidget/EmbedSocial src here.</p>
          </div>

          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Youtube className="h-5 w-5" /> YouTube
            </h3>
            <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src="https://www.youtube.com/embed/videoseries?list=UUSnU37N9ovE3tC50apgT4PA"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="BreakMyWallet Uploads"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="shop" className="container py-16">
        <div className="card p-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Shop</h2>
          <p className="text-zinc-300 mt-2">
            Hooking this up to Shopify next. If you’ve generated Buy Button embeds, paste them here.
          </p>
        </div>
      </section>

      <section id="contact" className="container py-16">
        <div className="card p-6">
          <h3 className="text-2xl font-bold">Contact</h3>
          <p className="text-zinc-300 mt-2">Want to sponsor a segment or send parts to abuse? Hit the inbox.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="mailto:hello@breakmywallet.com" className="btn btn-primary"><Mail className="h-4 w-4" /> Email us</a>
            <a href="https://www.instagram.com/breakmywallet" className="btn btn-ghost">Instagram</a>
            <a href="https://www.youtube.com/@Breakmywalletmedia" className="btn btn-ghost">YouTube</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="container py-10 text-sm text-zinc-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo-mark.svg" alt="BreakMyWallet" width={24} height={24} />
            <span>BreakMyWallet</span>
          </div>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}