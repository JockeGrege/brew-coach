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
  gauge: {
    viewBox: "0 0 168 172",
    width: 168,
    height: 172,
    top: 40,
    bottom: 150,
    // Konformad tratt: rak avsmalning från bred kant ner mot det enda,
    // centrerade hålet.
    glassPath: "M20,40 L80,40 L54,150 L46,150 Z",
    decor: [
      // Spiralribborna, antydda som två diagonala linjer i övre tredjedelen.
      { line: { x1: 30, y1: 56, x2: 42, y2: 90 }, stroke: "#39362C" },
      { line: { x1: 70, y1: 56, x2: 58, y2: 90 }, stroke: "#39362C" },
    ],
  },
};
