import { clamp, round5 } from "./shared";

/* Större bädd binder mer CO₂ och behöver längre bloom: 30 s för en liten dos,
   upp mot 60 s för en full kanna. */
function bloomSeconds(dose) {
  return clamp(round5((30 + (dose - 20) * 0.9)), 30, 60);
}

/* De tre hällningarna delar det som blir kvar efter bloomen i tre lika
   stora steg. */
function pours(bloom, water) {
  const restWater = water - bloom;
  return [round5(bloom + restWater / 3), round5(bloom + (restWater * 2) / 3), water];
}

/* Hällningarna ska vara klara efter ca 56 % av måltiden, så att resten
   räcker till avrinningen. Ger 0:40 / 1:35 / 2:30 för 30 g och
   0:55 / 1:50 / 2:45 för 45 g — nära de scheman recepten själva anger. */
function lastPourAt(target, bloomSec) {
  return Math.max(bloomSec + 70, round5(target * 0.56));
}

export const chemex = {
  key: "chemex",
  label: "Chemex",
  doseRange: { min: 12, max: 75, default: 30, warnAbove: 65 },
  ratioRange: { min: 13, max: 19, default: 16 },
  bloomClamp: [25, 80],
  ROASTS: {
    light: { key: "light", tempMin: 95, tempMax: 96, temp: 96, t30: [240, 285], t45: [270, 315] },
    medium: { key: "medium", tempMin: 94, tempMax: 95, temp: 95, t30: [225, 270], t45: [255, 300] },
    dark: { key: "dark", tempMin: 92, tempMax: 93, temp: 93, t30: [210, 255], t45: [240, 285] },
  },
  bloomSeconds,
  pours,
  lastPourAt,
  // Guides consulted when setting these numbers (ratio, grind, temperature,
  // bloom, pour count, total time) — shown to the user via the header's
  // info icon.
  sources: [
    { label: "Equator Coffees — Chemex Brew Guide", url: "https://www.equatorcoffees.com/blogs/guides/chemex" },
    { label: "Bean Box — How to Use a Chemex", url: "https://beanbox.com/blog/how-to-use-a-chemex" },
    { label: "Blue Bottle Coffee — How to Brew with a Chemex", url: "https://bluebottlecoffee.com/us/eng/brew-guides/chemex" },
    { label: "Hop Culture — The 5 Minute or Less Chemex Brew Guide", url: "https://www.hopculture.com/how-to-chemex-brew-guide/" },
    { label: "Official Chemex Coffeemaker — filter-folding technique", url: "https://chemexcoffeemaker.com/pages/how-to-brew-with-chemex" },
  ],
  gauge: {
    viewBox: "0 0 168 172",
    width: 168,
    height: 172,
    top: 92,
    bottom: 152,
    glassPath: "M25,12 L47,88 L23,146 C23,152 27,156 33,156 L67,156 C73,156 77,152 77,146 L53,88 L75,12 Z",
    decor: [
      // Antydan om vattenytan i den vida trattöppningen.
      { path: "M29,15 C36,11 44,11 51,15 C58,19 63,19 71,15", fill: "none", stroke: "#39362C" },
      { path: "M40,74 L60,74 L63,100 L37,100 Z", fillToken: "collar" },
      { line: { x1: 37, y1: 87, x2: 63, y2: 87 }, stroke: "#7C5427" },
      // Läderbandets knut, med de två ändarna som hänger ner.
      { line: { x1: 48, y1: 87, x2: 45, y2: 98 }, stroke: "#7C5427" },
      { line: { x1: 52, y1: 87, x2: 55, y2: 98 }, stroke: "#7C5427" },
    ],
  },
};
