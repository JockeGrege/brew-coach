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
    top: 100,
    bottom: 158,
    // The fillable vessel is the carafe below the dripper (the dripper
    // itself, in decor, sits above it and is drawn once, statically). Its
    // faceted, slightly angular body — vs. V60's rounder one — echoes the
    // Kalita Wave's flat-bottomed, less curvy silhouette.
    glassPath: "M32,100 L76,100 L86,132 L76,158 L32,158 L22,132 Z",
    // Marken flyttas ut lite extra åt höger, så de inte kolliderar med
    // handtaget på karaffen.
    marksX: { tick1: 104, tick2: 116, label: 120 },
    decor: [
      // Det vågiga wave-filtret som sticker upp ovanför tratten.
      {
        path: "M18,20 C26,14 34,14 42,20 C50,26 58,26 66,20 C74,14 82,14 90,20 L90,28 L18,28 Z",
        fill: "#FFFFFF",
        stroke: "#39362C",
      },
      // Bred, flack tratt — smalnar av mot en platt botten i stället för en
      // spets, med solfjäderribbor som antyder filtrets veck.
      { path: "M22,28 L86,28 L70,78 L38,78 Z", fill: "#FFFFFF", stroke: "#39362C" },
      { line: { x1: 34, y1: 32, x2: 40, y2: 76 }, stroke: "#39362C" },
      { line: { x1: 54, y1: 32, x2: 54, y2: 76 }, stroke: "#39362C" },
      { line: { x1: 74, y1: 32, x2: 68, y2: 76 }, stroke: "#39362C" },
      // Den platta skivan tratten vilar i, bredare än både tratt och karaff.
      { path: "M14,80 C14,76 94,76 94,80 C94,84 14,84 14,80 Z", fill: "#FFFFFF", stroke: "#39362C" },
      // De små benen som lyfter skivan över karaffens mynning.
      { line: { x1: 28, y1: 84, x2: 30, y2: 100 }, stroke: "#39362C" },
      { line: { x1: 80, y1: 84, x2: 78, y2: 100 }, stroke: "#39362C" },
      // Handtaget på karaffen — en sluten ögla fäst i karaffens sida.
      { path: "M86,116 C106,116 106,144 86,144", fill: "none", stroke: "#39362C", strokeWidth: 2.5 },
    ],
  },
};
