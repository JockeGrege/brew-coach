export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round5 = (v) => Math.round(v / 5) * 5;

/* Every method's target time grows logarithmically with dose, anchored at
   its own 30 g and 45 g reference points (r.t30 / r.t45) and extrapolated
   from there — a doubled dose adds tens of seconds, not double the time. */
const LN15 = Math.log(45 / 30);

export function timeWindow(method, roastKey, dose) {
  const r = method.ROASTS[roastKey];
  const f = Math.log(clamp(dose, method.doseRange.min, method.doseRange.max) / 30) / LN15;
  return [
    Math.round(r.t30[0] + (r.t45[0] - r.t30[0]) * f),
    Math.round(r.t30[1] + (r.t45[1] - r.t30[1]) * f),
  ];
}

/* Evenly spaces N pour-start times between the end of the bloom and the
   moment the final pour begins, so any method can plug in its own pour
   count (Chemex: 3, V60: 2, ...) without re-deriving this. */
export function pourTimes(bloomSec, lastPourAt, pourCount) {
  if (pourCount <= 1) return [bloomSec];
  const gap = round5((lastPourAt - bloomSec) / (pourCount - 1));
  return Array.from({ length: pourCount }, (_, i) => bloomSec + i * gap);
}
