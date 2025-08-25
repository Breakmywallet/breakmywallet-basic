// app/lib/events.ts
export type EventCategory = "meet" | "show" | "track";
export type BmwEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  category: EventCategory;
  city?: string;
  state?: string;
  venue?: string;
  price?: string;
  url?: string;
};

export const events: BmwEvent[] = [
  { id: "nc-cnc-2025-06-22", title: "Caffeine & Carburetors — Downtown NC (Cars & Coffee)", date: "2025-06-22", time: "8:00 AM – 11:00 AM", category: "meet", city: "New Canaan", state: "CT", venue: "Downtown (Pine & Elm St.)", price: "$20 Vehicle Registration", url: "https://cbo.io/bidapp/index.php?slug=ccjune2025" },
  { id: "nc-cnc-2025-10-19", title: "Caffeine & Carburetors — Waveny Park", date: "2025-10-19", category: "meet", city: "New Canaan", state: "CT", venue: "Waveny Park", url: "https://caffeineandcarburetors.com/" },
  { id: "racemotive-rollcup-2025-06-21", title: "RaceMotive Roll‑Cup (Roll & Drag + Car Show)", date: "2025-06-21", category: "track", city: "Upper Marlboro", state: "MD", venue: "Maryland International Raceway", url: "https://www.racemotive.com/pages/rollcup" },
  { id: "racemotive-kotn-2025-08-30", title: "RaceMotive — King of the North Roll‑Racing", date: "2025-08-30", category: "track", city: "Mohnton", state: "PA", venue: "Maple Grove Raceway", url: "https://www.racemotive.com/pages/kingofthenorth" },
  { id: "mpact-2025-08-16", title: "MPACT Motorsports Festival & Car Show", date: "2025-08-16", category: "show", city: "Long Pond", state: "PA", venue: "Pocono Raceway", url: "https://www.mpacteast.com/" },
  { id: "fcpeuro-swede-2025-04-13", title: "FCP Euro Sunday Motoring Meet — Swede Speed (Volvo/Saab)", date: "2025-04-13", category: "meet", city: "Lakeville", state: "CT", venue: "Lime Rock Park", url: "https://limerock.com/events/sundays-at-the-park/" },
  { id: "fcpeuro-autobahn-2025-07-13", title: "FCP Euro Sunday Motoring Meet — Autobahn Origins (VW/Audi/Porsche/Mercedes)", date: "2025-07-13", category: "meet", city: "Lakeville", state: "CT", venue: "Lime Rock Park", url: "https://www.eventbrite.com/e/fcp-euro-sunday-motoring-meet-at-lime-rock-park-vwaudiporschemercedes-tickets-1217093833419" },
  { id: "fcpeuro-circuitlegends-2025-08-17", title: "FCP Euro Sunday Motoring Meet — Circuit Legends", date: "2025-08-17", category: "meet", city: "Lakeville", state: "CT", venue: "Lime Rock Park", url: "https://limerock.com/events/sundays-at-the-park/" },
  { id: "fcpeuro-autoberfest-2025-10-26", title: "FCP Euro Sunday Motoring Meet — Autoberfest (BMW/MINI)", date: "2025-10-26", category: "meet", city: "Lakeville", state: "CT", venue: "Lime Rock Park", url: "https://www.eventbrite.com/e/fcp-euro-sunday-motoring-meet-at-lime-rock-park-featuring-bmwmini-tickets-1218428896629" }
];
