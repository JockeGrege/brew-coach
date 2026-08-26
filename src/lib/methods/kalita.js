import { clamp, round5 } from "./shared";

function bloomSeconds(dose) {
  return clamp(round5(20 + dose * 0.5), 30, 45);
}

function pours(bloom, water) {
  const rest = water - bloom;
  return [round5(bloom + rest / 3), round5(bloom + (rest * 2) / 3), water];
}

function lastPourAt(target, bloomSec) {
  return Math.max(bloomSec + 60, round5(target * 0.55));
}

export const kalita = {
  key: "kalita",
  label: "Kalita Wave",
  doseRange: { min: 15, max: 40, default: 20, warnAbove: 35 },
  ratioRange: { min: 14, max: 17, default: 16 },
  bloomClamp: [30, 45],
  ROASTS: {
    light: { key: "light", tempMin: 94, tempMax: 96, temp: 95, t30: [195, 225], t45: [215, 245] },
    medium: { key: "medium", tempMin: 92, tempMax: 94, temp: 93, t30: [185, 215], t45: [205, 235] },
    dark: { key: "dark", tempMin: 90, tempMax: 92, temp: 91, t30: [175, 205], t45: [195, 225] },
  },
  bloomSeconds,
  pours,
  lastPourAt,
  sources: [
    { label: "Stumptown Coffee Roasters — Brew Guide: Kalita Wave", url: "https://www.stumptowncoffee.com/pages/brew-guide-kalita-wave" },
    { label: "Craft Coffee — Kalita Wave Brew Guide", url: "https://www.craftcoffee.com/how-to-make-coffee/kalita-wave-brew-guide" },
    { label: "Kurasu — Kalita Wave Brewing Guide", url: "https://kurasu.kyoto/blogs/kurasu-journal/kalita-wave-brewing-guide-how-we-do-it-at-kurasu" },
    { label: "James' Coffee Blog — My Kalita Wave Recipe", url: "https://jamesg.blog/2021/01/17/kalita-wave-recipe" },
    { label: "Perfect Daily Grind — Kalita Wave: The Story & Brewing Guide", url: "https://perfectdailygrind.com/2015/08/kalita-wave-the-story-brewing-guide/" },
  ],
  gauge: {
    viewBox: "0 0 168 172",
    width: 168,
    height: 172,
    top: 92,
    bottom: 152,
    // The fillable vessel is the mug below the dripper (the dripper itself,
    // in decor, sits above it and is drawn once, statically).
    glassPath: "M44,92 L60,92 L74,142 C74,148 70,152 65,152 L39,152 C34,152 30,148 30,142 Z",
    decor: [
      { path: "M15,16 L89,16 L83,24 L21,24 Z", fillToken: "collar" },
      // Wide-flared, flat-bottomed funnel (vs. V60's cone to a point) with
      // fanning rib lines, echoing the wave filter's ridges.
      { path: "M21,24 L83,24 L68,84 L36,84 Z", fill: "#FFFFFF", stroke: "#39362C" },
      { line: { x1: 34, y1: 28, x2: 40, y2: 82 }, stroke: "#39362C" },
      { line: { x1: 52, y1: 28, x2: 52, y2: 82 }, stroke: "#39362C" },
      { line: { x1: 70, y1: 28, x2: 64, y2: 82 }, stroke: "#39362C" },
      { line: { x1: 36, y1: 84, x2: 68, y2: 84 }, stroke: "#39362C", strokeWidth: 2 },
    ],
  },
};
