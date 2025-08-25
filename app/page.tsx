'use client';

import React from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { ArrowRight, ShoppingBag, Youtube, Instagram, Mail, Calendar } from "lucide-react";
import { events as allEvents } from "./lib/events";

/* ---- Events Section ---- */
function EventsSection() {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<"all" | "meet" | "show" | "track">("all");
  const [stateFilter, setStateFilter] = React.useState<string>("CT"); // default to CT

  const states = Array.from(new Set(allEvents.map(e => e.state).filter(Boolean) as string[])).sort();

  const filtered = allEvents
    .filter(e => new Date(e.date) >= new Date(new Date().toDateString()))
    .filter(e => (cat === "all" ? true : e.category === cat))
    .filter(e => (stateFilter === "all" ? true : e.state === stateFilter))
    .filter(e => {
      if (!q.trim()) return true;
      const n = q.toLowerCase();
      return (
        (e.title || "").toLowerCase().includes(n) ||
        (e.city || "").toLowerCase().includes(n) ||
        (e.venue || "").toLowerCase().includes(n)
      );
    })
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <section id="events" className="container py-16">
      <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
        <Calendar className="h-6 w-6" /> Upcoming Events
      </h2>

      <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="inline-flex rounded-xl overflow-hidden border border-white/15">
          {(["all", "meet", "show", "track"] as const).map(k => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={`px-3 py-2 text-sm ${cat === k ? "bg-white text-black" : "text-zinc-300 hover:bg-white/10"}`}
            >
              {k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 text-sm"
        >
          <option value="all">All States</option>
          {states.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search title, city, venue…"
          className="flex-1 rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        {filtered.length === 0 && <div className="text-zinc-400">No events match your filters.</div>}
        {filtered.slice(0, 12).map(e => (
          <div key={e.id} className="card p-5 flex items-start gap-4">
            <div className="flex-shrink-0 text-center border border-white/15 rounded-xl px-3 py-2">
              <div className="text-xl font-extrabold" style={{ color: "var(--bmw-blue)" }}>
                {new Date(e.date).toLocaleString(undefined, { day: "2-digit" })}
              </div>
              <div className="text-xs uppercase text-zinc-400 tracking-wider">
                {new Date(e.date).toLocaleString(undefined, { month: "short" })}
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{e.title}</div>
              <div className="text-sm text-zinc-300">
                {fmtDate(e.date)}{e.time ? ` @ ${e.time}` : ""}
              </div>
              {(e.venue || e.city) && (
                <div className="text-sm text-zinc-400">
                  {[e.venue, e.city, e.state].filter(Boolean).join(" • ")}
                </div>
              )}
              <div className="mt-2 text-xs uppercase tracking-wide text-zinc-400">
                {e.category === "meet" ? "Cars & Coffee" : e.category === "show" ? "Show / Festival" : "Track / Racing"}
                {e.price ? ` • ${e.price}` : ""}
              </div>
              {e.url && (
                <a href={e.url} className="text-sm link inline-block mt-2" target="_blank">
                  Details / RSVP →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <div id="home">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10">
        <div className="container">
          <div className="flex h-16 items-center justify-between">
            <Link href="#home" className="flex items-center gap-3">
              <Image src="/logo-mark.svg" alt="BreakMyWallet" width={32} height={32} priority />
              <span className="font-extrabold tracking-tight text-lg">BreakMyWallet</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <a href="#social" className="link">Social</a>
              <a href="#events" className="link">Events</a>
              <a href="#shop" className="link">Shop</a>
              <a href="#contact" className="link">Contact</a>
            </nav>
            <a href="#shop" className="btn btn-primary"><ShoppingBag className="h-4 w-4" /> Shop</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: "radial-gradient(1200px 600px at 20% -10%, rgba(18,164,255,.20), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(11,111,181,.25), transparent 50%)" }} />
        <div className="container py-20">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Image src="/logo-wordmark.svg" alt="BreakMyWallet" width={240} height={48} className="opacity-95" priority />
            <span className="text-sm text-zinc-400">Real builds. Real costs.</span>
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight leading-none">
            Build fast. Break parts. <span style={{ color: "var(--bmw-blue)" }}>Tell the truth.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-300">Garage-born media: dyno days, lap times, parts lists, and full receipts. No fluff.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="#social" className="btn btn-primary">Watch & Follow <ArrowRight className="h-4 w-4" /></a>
            <a href="#shop" className="btn btn-ghost">Latest Drops</a>
          </div>
        </div>
      </section>

      {/* Social */}
      <section id="social" className="container py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">Latest from the Garage</h2>
        <Script src="https://snapwidget.com/js/snapwidget.js" strategy="afterInteractive" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Instagram className="h-5 w-5" /> Instagram</h3>
            <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
              <iframe src="PASTE_YOUR_INSTAGRAM_WIDGET_SRC_HERE" className="w-full h-full" allowTransparency scrolling="no" frameBorder="0" title="Instagram Feed" />
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Youtube className="h-5 w-5" /> YouTube</h3>
            <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
              <iframe src="https://www.youtube.com/embed/videoseries?list=UUSnU37N9ovE3tC50apgT4PA" className="w-full h-full" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="BreakMyWallet Uploads" />
            </div>
          </div>
        </div>
      </section>

      {/* Events */}
      {EventsSection()}

      {/* Shop with embedded Shopify Buy Button */}
      <section id="shop" className="container py-16">
        <div className="card p-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Shop</h2>
          <p className="text-zinc-300 mt-2">Our latest drop:</p>
          <div
            className="mt-6"
            dangerouslySetInnerHTML={{
              __html: `
<div id='product-component-1756128579018'></div>
<script type="text/javascript">
(function () {
  var scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
  if (window.ShopifyBuy) { if (window.ShopifyBuy.UI) { ShopifyBuyInit(); } else { loadScript(); } } else { loadScript(); }
  function loadScript() { var script = document.createElement('script'); script.async = true; script.src = scriptURL; (document.head || document.body).appendChild(script); script.onload = ShopifyBuyInit; }
  function ShopifyBuyInit() {
    var client = ShopifyBuy.buildClient({ domain: 'pn0jcb-5f.myshopify.com', storefrontAccessToken: 'b18cb9272b05835d94265a6c09aee73f' });
    ShopifyBuy.UI.onReady(client).then(function (ui) {
      ui.createComponent('product', {
        id: '7424745898059',
        node: document.getElementById('product-component-1756128579018'),
        moneyFormat: '%24%7B%7Bamount%7D%7D',
        options: {
          product: {
            styles: { product: { "@media (min-width: 601px)": { "max-width": "100%", "margin-bottom": "24px" } },
            button: { ":hover": { "background-color": "#0079b6" }, "background-color": "#0086ca", ":focus": { "background-color": "#0079b6" } } },
            text: { button: "Add to cart" }
          },
          cart: { styles: { button: { ":hover": { "background-color": "#0079b6" }, "background-color": "#0086ca", ":focus": { "background-color": "#0079b6" } } },
                  text: { total: "Subtotal", button: "Checkout" } },
          toggle: { styles: { toggle: { "background-color": "#0086ca", ":hover": { "background-color": "#0079b6" }, ":focus": { "background-color": "#0079b6" } } } }
        }
      });
    });
  }
})();
</script>`,
            }}
          />
        </div>
      </section>

      {/* Contact */}
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

      {/* Footer */}
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
