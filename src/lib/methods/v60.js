import { clamp, round5 } from "./shared";

/* V60 dricker igenom mycket snabbare än Chemex (tunnare filter, ett stort
   hål), så måltiden är mycket kortare — allmänt refererat riktvärde är
   2:30–3:30 totalt. Hoffmanns mycket spridda "Ultimate V60"-recept (30 g
   kaffe, 500 g vatten, mellanrost-aktig kurva) landar exakt på 3:30 och
   ankrar mellanrost/30 g-punkten här (se method.ROASTS.medium.t30). Ljus/mörk
   rost skiftas i samma riktning och proportion som för Chemex: ljusare tål
   mer tid, mörkare vill ha kortare. */

/* Bloomen skalar med dosen inom det allmänt rekommenderade fönstret
   30–50 s. Hoffmanns recept blommar 30 g kaffe i 45 s, vilket är
   ankarpunkten kurvan går igenom. */
function bloomSeconds(dose) {
  return clamp(round5(dose + 15), 30, 50);
}

/* Hoffmanns teknik häller inte i lika tredjedelar av det som blir kvar
   (Chemex-stilen) utan i två klunkar räknat på totalvolymen: upp till 60 %
   av allt vatten, sedan resten. Med 30 g / 500 g ger det exakt hans 300 g
   och 500 g brytpunkter. */
function pours(bloom, water) {
  return [round5(water * 0.6), water];
}

/* Den sista hällningen börjar vid ca 36 % av måltiden — i Hoffmanns recept
   0:45 bloom, huvudhällning klar 1:15, andra hällningen börjar där (75 s av
   210 s mål ≈ 36 %). */
function lastPourAt(target, bloomSec) {
  return Math.max(bloomSec + 20, round5(target * 0.36));
}

export const v60 = {
  key: "v60",
  label: "V60",
  doseRange: { min: 10, max: 40, default: 30, warnAbove: 35 },
  ratioRange: { min: 14, max: 18, default: 16 },
  bloomClamp: [20, 55],
  ROASTS: {
    light: { key: "light", tempMin: 95, tempMax: 96, temp: 96, t30: [205, 235], t45: [220, 250] },
    medium: { key: "medium", tempMin: 93, tempMax: 94, temp: 94, t30: [195, 225], t45: [210, 240] },
    dark: { key: "dark", tempMin: 91, tempMax: 92, temp: 92, t30: [185, 215], t45: [200, 230] },
  },
  bloomSeconds,
  pours,
  lastPourAt,
  // Guides consulted when setting these numbers (ratio, grind, temperature,
  // bloom, pour structure, total time) — shown to the user via the header's
  // info icon.
  sources: [
    { label: "The Coffee Calculator — V60 Pour-Over Brewing Guide", url: "https://thecoffeecalculator.com/guides/brewing-with-pour-over-v60" },
    { label: "Kaldi's Coffee — The V60 Brew Guide", url: "https://kaldiscoffee.com/blogs/recipes/v60-coffee-brewer-guide-and-recipe" },
    { label: "Honest Coffee Guide — James Hoffmann's Ultimate V60 Recipe", url: "https://honestcoffeeguide.com/brew-recipes/james-hoffmann-v60/" },
    { label: "Honest Coffee Guide — Pour-Over Grind Size", url: "https://honestcoffeeguide.com/pour-over-grind-size/" },
  ],
  gauge: {
    viewBox: "0 0 168 172",
    width: 168,
    height: 172,
    // Bryggnivån visas i servern (karaffen) längst ner, precis som i
    // verkligheten — kaffet droppar genom tratten och samlas där.
    top: 96,
    bottom: 158,
    glassPath: "M34,96 L74,96 L84,150 C84,155 79,158 74,158 L34,158 C29,158 24,155 24,150 Z",
    // Marken flyttas ut lite extra åt höger jämfört med Chemex, så de inte
    // kolliderar med handtaget på karaffen.
    marksX: { tick1: 102, tick2: 114, label: 118 },
    decor: [
      // Den ljusa kanten längst upp på tratten.
      { path: "M14,12 L92,12 L86,20 L20,20 Z", fill: "#FFFFFF", stroke: "#39362C" },
      // Själva tratten: bred kant som smalnar av mot det enda, centrerade
      // hålet — ett tydligt spetsigt V, till skillnad från Kalitas platta botten.
      { path: "M20,20 L86,20 L58,90 L48,90 Z", fill: "#FFFFFF", stroke: "#39362C" },
      // Spiralribborna, antydda som tre linjer som viftar ut mot kanten.
      { line: { x1: 53, y1: 24, x2: 53, y2: 88 }, stroke: "#39362C" },
      { line: { x1: 32, y1: 28, x2: 49, y2: 88 }, stroke: "#39362C" },
      { line: { x1: 74, y1: 28, x2: 57, y2: 88 }, stroke: "#39362C" },
      // Bandet där tratten möter karaffen.
      { path: "M46,90 L60,90 L60,96 L46,96 Z", fill: "#FFFFFF", stroke: "#39362C" },
      // Handtaget på karaffen — en sluten ögla fäst i karaffens sida.
      { path: "M84,116 C104,116 104,146 84,146", fill: "none", stroke: "#39362C", strokeWidth: 2.5 },
    ],
  },
};
