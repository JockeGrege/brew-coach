import { useState, useEffect, useRef } from "react";
import { getItem, setItem } from "./lib/storage";
import { useAuth } from "./lib/useAuth";
import { signInWithGoogle, signOut } from "./lib/firebase";

/* ------------------------------------------------------------------ */
/*  Designtokens                                                       */
/* ------------------------------------------------------------------ */

const C = {
  paper: "#E7E5DC",
  card: "#FBFAF6",
  ink: "#1B1D19",
  ink2: "#5F635A",
  ink3: "#8D9086",
  line: "#D3D0C4",
  collar: "#A9773C",
  brew: "#452B18",
  hot: "#9E3B24",
  ok: "#3F6B4A",
};

const dateInput = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 15,
  border: "1px solid #D3D0C4",
  borderRadius: 3,
  background: "#fff",
  color: "#1B1D19",
  boxSizing: "border-box",
};

const F = {
  display: "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif",
  ui: "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,sans-serif",
  mono: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
};

/* ------------------------------------------------------------------ */
/*  Bryggdata och logik                                                */
/* ------------------------------------------------------------------ */

const ROASTS = {
  light: {
    key: "light", label: "Ljusrost", tempMin: 96, tempMax: 97, temp: 97,
    grind: "Medium-grov", t30: [240, 285], t45: [270, 315],
    hint: "Blommigt och syrligt. Tål högst temperatur och längst tid.",
  },
  medium: {
    key: "medium", label: "Mellanrost", tempMin: 94, tempMax: 95, temp: 95,
    grind: "Medium-grov", t30: [225, 270], t45: [255, 300],
    hint: "Balanserat. Mittfåran i både temperatur och tid.",
  },
  dark: {
    key: "dark", label: "Mörkrost", tempMin: 92, tempMax: 93, temp: 93,
    grind: "Lite grövre", t30: [210, 255], t45: [240, 285],
    hint: "Choklad och rostade toner. Blir lätt besk — kortare tid, lägre värme.",
  },
};

const TASTE = {
  sour: "för surt",
  bitter: "för beskt eller torrt",
  weak: "för svagt",
  strong: "för starkt",
  balanced: "bra balanserat",
};

const FLOW = {
  slow: "långsammare än målet",
  fast: "snabbare än målet",
  ok: "inom måltiden",
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round5 = (v) => Math.round(v / 5) * 5;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.abs(Math.round(s % 60))).padStart(2, "0")}`;

/* Bryggtiden växer logaritmiskt med dosen, inte linjärt. En dubbling av dosen
   lägger på ungefär 30–60 s, inte det dubbla: bädden blir djupare men också
   bredare, så flödet per gram kaffe är i stort sett detsamma.
   Kurvan t(d) = t30 + k · ln(d/30) går exakt genom ankarvärdena för 30 g och
   45 g och extrapolerar därifrån. Med k ≈ 74 s ger den 20 g → 3:30,
   30 g → 4:00, 45 g → 4:30, 60 g → 4:51, vilket ligger inom några tiotals
   sekunder från publicerade Chemex-recept i hela intervallet. */
const LN15 = Math.log(45 / 30);

function timeWindow(roastKey, dose) {
  const r = ROASTS[roastKey];
  const f = Math.log(clamp(dose, 10, 80) / 30) / LN15;
  return [
    Math.round(r.t30[0] + (r.t45[0] - r.t30[0]) * f),
    Math.round(r.t30[1] + (r.t45[1] - r.t30[1]) * f),
  ];
}

/* Större bädd binder mer CO₂ och behöver längre bloom: 30 s för en liten dos,
   upp mot 60 s för en full kanna. */
function bloomSeconds(dose) {
  return clamp(Math.round((30 + (dose - 20) * 0.9) / 5) * 5, 30, 60);
}

function grindNote(roastKey, offset) {
  const base = ROASTS[roastKey].grind;
  if (offset === 0) return base;
  const steps = Math.abs(offset);
  return `${base}, ${steps} steg ${offset > 0 ? "grövre" : "finare"}`;
}

function doseFromCups(cups, ratio) {
  // ~170 ml färdigt kaffe per kopp. Bädden håller kvar ca 2 g vatten per g kaffe.
  return clamp(Math.round((cups * 170) / (ratio - 2)), 12, 90);
}

/* --- Vila efter rost -------------------------------------------------
   Rostdatumet är den enda uppgiften på paketet med en entydig koppling till
   en bryggparameter. Färskt kaffe är fullt av CO₂ som stöter bort vattnet
   under bloomen, vilket ger ojämn extraktion och en vassare kopp än kaffet
   förtjänar. Mörkrost gasar ur snabbare än ljusrost, så fönstren flyttas
   med rostnivån. Bara bloomtiden justeras — resten är information. */

const REST_WINDOWS = {
  light: { gassy: 5, peak: 10, fading: 28, old: 45 },
  medium: { gassy: 4, peak: 8, fading: 24, old: 40 },
  dark: { gassy: 2, peak: 6, fading: 18, old: 30 },
};

function daysSinceRoast(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days < 0 || days > 400 ? null : days;
}

/* Bäst före-datumet är näst bästa källa. Nästan alla svenska rosterier sätter
   det 12 månader efter rost, så datumet kan räknas baklänges till ett ungefärligt
   rostdatum. Osäkerheten är veckor, inte dagar — därför halveras justeringen och
   allting märks som uppskattat. Anges båda datumen vinner rostdatumet. */
const SHELF_MONTHS = 12;

function estimateRoastFromBestBefore(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() - SHELF_MONTHS);
  return d.toISOString().slice(0, 10);
}

const dayName = (n) => `${n} ${Math.abs(n) === 1 ? "dag" : "dagar"}`;
const shortDate = (d) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d;
}

/* Allt appen vet om påsens ålder, i ett objekt. Används både i setup och i
   receptet så att båda skärmarna säger exakt samma sak. */
function ageProfile(roastKey, cfg) {
  const stated = cfg.roastDate || null;
  const iso = stated || estimateRoastFromBestBefore(cfg.bestBefore);
  const days = daysSinceRoast(iso);
  if (days === null) return null;

  const estimated = !stated;
  const w = REST_WINDOWS[roastKey];
  const sweetFrom = addDays(iso, w.peak);
  const sweetTo = addDays(iso, w.fading - 1);
  const sweet = `${shortDate(sweetFrom)} – ${shortDate(sweetTo)}`;

  const status =
    days < w.peak
      ? `Som bäst om ${dayName(w.peak - days)}.`
      : days < w.fading
      ? `Som bäst nu — ${dayName(w.fading - days)} kvar av fönstret.`
      : `Fönstret tog slut för ${dayName(days - w.fading + 1)} sedan.`;

  const age = `${dayName(days)} efter rost`;
  const p =
    days < w.gassy
      ? {
          key: "fresh", bloomDelta: 20, tone: "warn", label: "För färskt",
          note: `${age}. Bädden sväller kraftigt och stöter bort vattnet, så extraktionen blir ojämn och koppen smakar vassare än kaffet är. Bloomen förlängs för att kompensera.`,
        }
      : days < w.peak
      ? {
          key: "gassy", bloomDelta: 10, tone: "note", label: "Fortfarande gasigt",
          note: `${age}. Fullt drickbart, men det finns CO₂ kvar. Bloomen förlängs så att gasen hinner ut innan huvudhällningarna.`,
        }
      : days < w.fading
      ? {
          key: "peak", bloomDelta: 0, tone: "ok", label: "I fönstret",
          note: `${age}, mitt i det bästa fönstret. Standardbloom. Det är nu kvarninställningen är värd att finkalibrera — vad som händer i koppen beror på dig och inte på kaffets ålder.`,
        }
      : days < w.old
      ? {
          key: "fading", bloomDelta: -5, tone: "note", label: "På väg ut",
          note: `${age}. Mindre CO₂ kvar ger en svagare bloom, så den kortas. Tappar koppen blommighet nu är det åldern som talar, inte receptet.`,
        }
      : {
          key: "old", bloomDelta: -10, tone: "warn", label: "Förbi sin tid",
          note: `${age}. Aromatiken har till stor del vittrat bort. Kortare bloom, men räkna inte med att någon justering väger upp det — spara hellre feedbacken till nästa påse.`,
        };

  /* Uppskattade datum får inte styra lika hårt som ett avläst rostdatum. */
  const bloomDelta = estimated ? clamp(p.bloomDelta, -5, 10) : p.bloomDelta;
  const bbLeft = cfg.bestBefore ? -daysSinceRoast(cfg.bestBefore) : null;

  return {
    ...p,
    days,
    bloomDelta,
    estimated,
    sweet,
    sweetFrom: sweetFrom.toISOString().slice(0, 10),
    status,
    expired: cfg.bestBefore ? new Date(`${cfg.bestBefore}T12:00:00`) < new Date() : false,
    note: estimated
      ? `${p.note} Åldern är uppskattad från bäst före-datumet med ${SHELF_MONTHS} månaders hållbarhet, så räkna med några veckors osäkerhet — justeringen är dämpad därefter.`
      : p.note,
  };
}

function buildRecipe(cfg) {
  const roast = ROASTS[cfg.roast];
  const dose = cfg.dose;
  const water = Math.round(dose * cfg.ratio);
  const bloom = round5(dose * 2);
  const restWater = water - bloom;
  const [lo, hi] = timeWindow(cfg.roast, dose);
  const target = Math.round((lo + hi) / 2);
  const rest = ageProfile(cfg.roast, cfg);

  /* Hällningarna ska vara klara efter ca 56 % av måltiden, så att resten
     räcker till avrinningen. Ger 0:40 / 1:35 / 2:30 för 30 g och
     0:55 / 1:50 / 2:45 för 45 g — nära de scheman recepten själva anger. */
  const bloomSec = clamp(bloomSeconds(dose) + (rest ? rest.bloomDelta : 0), 25, 80);
  const lastPour = Math.max(bloomSec + 70, round5(target * 0.56));
  const gap = round5((lastPour - bloomSec) / 2);

  return {
    roast: cfg.roast,
    roastLabel: roast.label,
    dose,
    water,
    ratio: cfg.ratio,
    temperature: cfg.temperature,
    grindOffset: cfg.grindOffset,
    grindNote: grindNote(cfg.roast, cfg.grindOffset),
    roastDate: cfg.roastDate || null,
    bestBefore: cfg.bestBefore || null,
    rest,
    bloom,
    bloomSec,
    pours: [round5(bloom + restWater / 3), round5(bloom + (restWater * 2) / 3), water],
    pourTimes: [bloomSec, bloomSec + gap, bloomSec + 2 * gap],
    targetLo: lo,
    targetHi: hi,
    target,
  };
}

function buildSteps(r) {
  return [
    {
      id: "rinse",
      title: "Skölj filtret",
      detail: "Vik filtret så att tre lager ligger mot pipen. Skölj igenom med hett vatten och häll ur sköljvattnet.",
    },
    {
      id: "grind",
      title: "Mal och nolla vågen",
      detail: `Mal ${r.dose} g på ${r.grindNote.toLowerCase()}. Jämna till bädden och nolla vågen. Vattnet ska hålla ${r.temperature} °C.`,
    },
    {
      id: "bloom",
      title: "Bloom",
      detail: `Häll till ${r.bloom} g så att allt kaffe blir blött. Rör om lätt och låt stå ${r.bloomSec} sekunder.`,
      target: r.bloom,
      at: 0,
    },
    { id: "p1", title: "Hällning 1", detail: `Häll i spiral upp till ${r.pours[0]} g.`, target: r.pours[0], at: r.pourTimes[0] },
    { id: "p2", title: "Hällning 2", detail: `Fyll på till ${r.pours[1]} g när nivån sjunkit.`, target: r.pours[1], at: r.pourTimes[1] },
    { id: "p3", title: "Hällning 3", detail: `Sista hällningen, upp till ${r.pours[2]} g.`, target: r.pours[2], at: r.pourTimes[2] },
    {
      id: "drawdown",
      title: "Låt rinna klart",
      detail: `Måltid ${fmt(r.targetLo)}–${fmt(r.targetHi)}. Stoppa klockan när bädden är torrlagd och lyft filtret.`,
      target: r.water,
    },
  ];
}

/* Regelmotorn: flödet styr malningen, smaken får temperatur och ratio. */
function suggest(recipe, fb) {
  const roast = ROASTS[recipe.roast];
  let grind = 0;
  let temperature = recipe.temperature;
  let ratio = recipe.ratio;
  const why = [];

  if (fb.flow === "slow") grind = 1;
  if (fb.flow === "fast") grind = -1;

  if (fb.taste === "sour") {
    if (grind === 1) {
      const t = clamp(temperature + 1, roast.tempMin, roast.tempMax);
      if (t !== temperature) {
        temperature = t;
        why.push(`Surt betyder underextraherat, men tiden drog över — därför grövre malning och en grad varmare vatten i stället.`);
      } else {
        why.push(`Surt betyder underextraherat. Malningen får ändå gå grövre eftersom tiden drog över, och ${temperature} °C är redan max för ${roast.label.toLowerCase()}.`);
      }
    } else if (grind === -1) {
      why.push("Finare malning fixar både den snabba tiden och surheten.");
    } else {
      grind = -1;
      why.push("Surt betyder underextraherat. Finare malning ger mer utbyte.");
    }
  }

  if (fb.taste === "bitter") {
    if (grind === -1) {
      const t = clamp(temperature - 2, roast.tempMin, roast.tempMax);
      if (t !== temperature) {
        temperature = t;
        why.push("Beskt betyder överextraherat, men tiden var för kort — därför finare malning och svalare vatten.");
      } else {
        why.push(`Beskt betyder överextraherat, men tiden var för kort. ${temperature} °C är redan lägst för ${roast.label.toLowerCase()}.`);
      }
    } else if (grind === 1) {
      why.push("Grövre malning kortar både tiden och beskan.");
    } else {
      grind = 1;
      why.push("Beskt betyder överextraherat. Grövre malning drar ur mindre.");
    }
  }

  if (fb.taste === "weak") {
    ratio = clamp(ratio - 1, 13, 19);
    why.push(`Tunt kaffe är en fråga om styrka, inte extraktion. Starkare ratio 1:${ratio} ger mer kaffe per liter.`);
  }

  if (fb.taste === "strong") {
    ratio = clamp(ratio + 1, 13, 19);
    why.push(`Svagare ratio 1:${ratio} tar ner styrkan utan att röra smakbilden.`);
  }

  if (fb.taste === "balanced" && grind === 0) {
    why.push("Smaken satt och tiden höll. Kör exakt samma inställningar igen.");
  } else if (fb.taste === "balanced") {
    why.push("Smaken satt, så bara tiden justeras.");
  }

  /* Rostdatumet får tolka feedbacken, inte styra siffrorna. Är kaffet för
     färskt är surhet oftast CO₂ som stört extraktionen, och då är malningen
     fel sak att skruva på — man kalibrerar mot en störning som försvinner
     av sig själv om ett par dagar. */
  const rest = recipe.rest;
  if (rest && (rest.key === "fresh" || rest.key === "gassy") && fb.taste === "sour") {
    if (fb.flow === "ok") {
      grind = 0;
      temperature = recipe.temperature;
      why.length = 0;
      why.push(
        `Tiden höll, men kaffet är bara ${rest.days} dagar från rost. Så här tidigt kommer surheten oftast från koldioxid som stöter bort vattnet under bloomen — delar av bädden hinner aldrig extraheras.`
      );
      why.push("Rör ingenting. Brygg samma recept om två–tre dagar och jämför: skiljer sig koppen åt var det kaffet, inte kvarnen.");
    } else {
      why.push(
        `Med ${rest.days} dagar från rost kan en del av surheten vara CO₂ snarare än underextraktion. Justeringen ovan gäller tiden — vänta med att jaga smaken tills kaffet vilat ut.`
      );
    }
  }

  if (rest && (rest.key === "fading" || rest.key === "old") && (fb.taste === "weak" || fb.taste === "sour")) {
    why.push(
      `Kaffet är ${rest.days} dagar gammalt. Tunnhet och platta toner så här sent är bortvittrad aromatik, och receptet kan dölja det men inte lösa det.`
    );
  }

  return {
    grindOffset: clamp(recipe.grindOffset + grind, -6, 6),
    grindStep: grind,
    temperature,
    ratio,
    why,
  };
}

function changeList(recipe, s) {
  const rows = [];
  rows.push({
    label: "Malning",
    value: s.grindStep === 0 ? "Oförändrad" : `1 steg ${s.grindStep > 0 ? "grövre" : "finare"}`,
    changed: s.grindStep !== 0,
  });
  rows.push({
    label: "Temperatur",
    value: s.temperature === recipe.temperature ? `${s.temperature} °C, oförändrad` : `${recipe.temperature} → ${s.temperature} °C`,
    changed: s.temperature !== recipe.temperature,
  });
  rows.push({
    label: "Ratio",
    value: s.ratio === recipe.ratio ? `1:${s.ratio}, oförändrad` : `1:${recipe.ratio} → 1:${s.ratio}`,
    changed: s.ratio !== recipe.ratio,
  });
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Små byggstenar                                                     */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }) {
  return (
    <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.ink3 }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 4, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style }) {
  const base = {
    fontFamily: F.ui,
    fontSize: 15,
    fontWeight: 500,
    padding: "13px 18px",
    borderRadius: 3,
    cursor: disabled ? "default" : "pointer",
    width: "100%",
    opacity: disabled ? 0.45 : 1,
    transition: "background 120ms ease, color 120ms ease",
  };
  const skins = {
    primary: { background: C.ink, color: C.card, border: `1px solid ${C.ink}` },
    quiet: { background: "transparent", color: C.ink, border: `1px solid ${C.line}` },
    plain: { background: "transparent", color: C.ink2, border: "1px solid transparent", padding: "10px 4px", fontSize: 14 },
  };
  return (
    <button className="cbc-btn" onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...skins[variant], ...style }}>
      {children}
    </button>
  );
}

function Choice({ label, sub, selected, onClick }) {
  return (
    <button
      className="cbc-btn"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 3,
        cursor: "pointer",
        background: selected ? C.ink : "transparent",
        color: selected ? C.card : C.ink,
        border: `1px solid ${selected ? C.ink : C.line}`,
        fontFamily: F.ui,
        fontSize: 15,
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 500 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 12.5, marginTop: 3, color: selected ? "rgba(251,250,246,0.72)" : C.ink3, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </button>
  );
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontFamily: F.ui, fontSize: 14, color: C.ink2 }}>{label}</span>
      <span style={{ fontFamily: F.mono, fontSize: 15, fontVariantNumeric: "tabular-nums", color: accent || C.ink }}>{value}</span>
    </div>
  );
}

/* Signaturen: Chemex-silhuetten som nivåmätare med gramskala */
function BrewGauge({ recipe, poured }) {
  const frac = clamp(poured / recipe.water, 0, 1);
  const top = 92, bottom = 152;
  const fillY = bottom - frac * (bottom - top);
  const marks = [
    { g: recipe.bloom, l: "bloom" },
    { g: recipe.pours[0], l: "1" },
    { g: recipe.pours[1], l: "2" },
    { g: recipe.pours[2], l: "3" },
  ];
  const glass = "M25,12 L47,88 L23,146 C23,152 27,156 33,156 L67,156 C73,156 77,152 77,146 L53,88 L75,12 Z";
  return (
    <svg viewBox="0 0 168 172" style={{ width: 168, height: 172, display: "block" }} aria-hidden="true">
      <defs>
        <clipPath id="cbc-glass">
          <path d={glass} />
        </clipPath>
      </defs>
      <path d={glass} fill="#FFFFFF" stroke={C.line} strokeWidth="1.5" />
      <g clipPath="url(#cbc-glass)">
        <rect x="0" y={fillY} width="100" height={bottom - fillY + 8} fill={C.brew} style={{ transition: "y 400ms ease" }} />
      </g>
      <path d="M40,74 L60,74 L63,100 L37,100 Z" fill={C.collar} />
      <line x1="37" y1="87" x2="63" y2="87" stroke="#7C5427" strokeWidth="1.2" />
      {marks.map((m) => {
        const y = bottom - clamp(m.g / recipe.water, 0, 1) * (bottom - top);
        return (
          <g key={m.l}>
            <line x1="84" y1={y} x2="96" y2={y} stroke={poured >= m.g ? C.ink : C.line} strokeWidth="1" />
            <text x="100" y={y + 3.5} fill={poured >= m.g ? C.ink : C.ink3} fontFamily={F.mono} fontSize="9.5">
              {m.g} g
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Appen                                                              */
/* ------------------------------------------------------------------ */

const STORE_KEY = "chemex:v1";

export default function ChemexBrewCoach() {
  const user = useAuth();
  const [authError, setAuthError] = useState(null);
  const [screen, setScreen] = useState("home");
  const [loaded, setLoaded] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [brews, setBrews] = useState([]);

  const [cfg, setCfg] = useState({ roast: "light", inputMode: "dose", dose: 30, cups: 2, ratio: 16, temperature: 97, grindOffset: 0, roastDate: null, bestBefore: null });
  const [recipe, setRecipe] = useState(null);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [fb, setFb] = useState({ taste: null, flow: null, comment: "" });
  const [actual, setActual] = useState(0);
  const [result, setResult] = useState(null);
  const tick = useRef(null);

  /* Ladda sparade bryggningar */
  useEffect(() => {
    (async () => {
      try {
        const r = await getItem(STORE_KEY);
        if (r && r.value) {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed.brews)) setBrews(parsed.brews);
        }
      } catch (e) {
        /* inget sparat än */
      }
      setLoaded(true);
    })();
  }, []);

  async function persist(next) {
    setBrews(next);
    try {
      const ok = await setItem(STORE_KEY, JSON.stringify({ brews: next }));
      setSaveFailed(!ok);
    } catch (e) {
      setSaveFailed(true);
    }
  }

  /* Klocka */
  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(tick.current);
    }
  }, [running]);

  const shell = {
    minHeight: "100vh",
    background: C.paper,
    color: C.ink,
    fontFamily: F.ui,
    padding: "22px 16px 40px",
    display: "flex",
    justifyContent: "center",
  };

  if (user === undefined) {
    return (
      <div style={shell}>
        <div style={{ fontFamily: F.mono, fontSize: 13, color: C.ink3 }}>Loggar in …</div>
      </div>
    );
  }

  if (user === null) {
    return (
      <div style={shell}>
        <div style={{ width: "100%", maxWidth: 460 }}>
          <Card style={{ textAlign: "center", padding: "44px 24px" }}>
            <div style={{ fontFamily: F.display, fontSize: 24, marginBottom: 8 }}>Chemex Brew Coach</div>
            <div style={{ fontSize: 14, color: C.ink2, marginBottom: 26, lineHeight: 1.5 }}>
              Logga in för att spara och synka dina bryggningar mellan enheter.
            </div>
            {authError && (
              <div style={{ border: `1px solid ${C.hot}`, color: C.hot, padding: "10px 12px", fontSize: 13, marginBottom: 18, borderRadius: 3, textAlign: "left" }}>
                Inloggningen misslyckades: {authError}
              </div>
            )}
            <Button
              onClick={() => {
                setAuthError(null);
                signInWithGoogle().catch((err) => setAuthError(err.message || String(err)));
              }}
            >
              Logga in med Google
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const last = brews[0] || null;

  /* --- flödeshjälpare --- */

  function openSetup(prefill) {
    setCfg((c) => ({ ...c, ...prefill }));
    setScreen("setup");
  }

  function toRecipe() {
    const dose = cfg.inputMode === "dose" ? cfg.dose : doseFromCups(cfg.cups, cfg.ratio);
    const r = buildRecipe({ ...cfg, dose });
    setRecipe(r);
    setSteps(buildSteps(r));
    setScreen("recipe");
  }

  function startBrew() {
    setStepIndex(0);
    setElapsed(0);
    setRunning(false);
    setScreen("brew");
  }

  function nextStep() {
    const cur = steps[stepIndex];
    if (cur.id === "grind") setRunning(true); // klockan startar när bloomen börjar
    if (stepIndex === steps.length - 1) {
      setRunning(false);
      const [lo, hi] = [recipe.targetLo, recipe.targetHi];
      setActual(elapsed);
      setFb({ taste: null, flow: elapsed > hi ? "slow" : elapsed < lo ? "fast" : "ok", comment: "" });
      setScreen("feedback");
      return;
    }
    setStepIndex((i) => i + 1);
  }

  async function saveFeedback() {
    const s = suggest(recipe, fb);
    const brew = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      roast: recipe.roast,
      coffeeDose: recipe.dose,
      water: recipe.water,
      ratio: recipe.ratio,
      temperature: recipe.temperature,
      grindOffset: recipe.grindOffset,
      grindNote: recipe.grindNote,
      roastDate: recipe.roastDate,
      bestBefore: recipe.bestBefore,
      restDays: recipe.rest ? recipe.rest.days : null,
      targetTime: fmt(recipe.target),
      actualTime: fmt(actual),
      feedback: { ...fb },
      suggestedNext: { grindOffset: s.grindOffset, temperature: s.temperature, ratio: s.ratio },
    };
    setResult({ recipe, s });
    await persist([brew, ...brews].slice(0, 60));
    setScreen("next");
  }

  const poured = (() => {
    if (!recipe) return 0;
    const done = steps.slice(0, stepIndex).filter((s) => s.target);
    return done.length ? done[done.length - 1].target : 0;
  })();

  /* ------------------------------------------------------------------ */

  return (
    <div style={shell}>
      <style>{`
        .cbc-btn:focus-visible { outline: 2px solid ${C.collar}; outline-offset: 2px; }
        .cbc-btn:hover:not(:disabled) { filter: brightness(1.06); }
        input, textarea { font-family: ${F.mono}; }
        input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.collar}; outline-offset: 1px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 460 }}>
        {/* Sidhuvud */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <button
            className="cbc-btn"
            onClick={() => setScreen("home")}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ fontFamily: F.display, fontSize: 21, letterSpacing: "-0.01em" }}>Chemex Brew Coach</div>
          </button>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            {brews.length > 0 && screen !== "history" && (
              <button
                className="cbc-btn"
                onClick={() => setScreen("history")}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.ink2 }}
              >
                Historik ({brews.length})
              </button>
            )}
            <button
              className="cbc-btn"
              onClick={() => signOut()}
              title={user.email || undefined}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.ink3 }}
            >
              Logga ut
            </button>
          </div>
        </div>

        {saveFailed && (
          <div style={{ border: `1px solid ${C.hot}`, color: C.hot, padding: "10px 12px", fontSize: 13, marginBottom: 14, borderRadius: 3 }}>
            Bryggningen kunde inte sparas. Skriv ner inställningarna innan du stänger sidan.
          </div>
        )}

        {/* ---------------- Startsida ---------------- */}
        {screen === "home" && (
          <div>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 4, padding: "20px 18px 8px" }}>
                <div style={{ flex: 1 }}>
                  <Eyebrow>{last ? "Senaste bryggningen" : "Ingen bryggning än"}</Eyebrow>
                  {last ? (
                    <>
                      <div style={{ fontFamily: F.display, fontSize: 26, lineHeight: 1.15, marginTop: 10 }}>
                        {ROASTS[last.roast].label}
                        <br />
                        blev {TASTE[last.feedback.taste]}
                      </div>
                      <div style={{ fontFamily: F.mono, fontSize: 12.5, color: C.ink2, marginTop: 12, lineHeight: 1.7 }}>
                        {last.coffeeDose} g · {last.water} g · 1:{last.ratio}
                        <br />
                        {last.temperature} °C · {last.actualTime}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontFamily: F.display, fontSize: 25, lineHeight: 1.2, marginTop: 10 }}>
                      Brygg en kopp. Nästa bygger på den.
                    </div>
                  )}
                </div>
                <div style={{ marginTop: -6, marginRight: -12 }}>
                  <BrewGauge
                    recipe={last ? { water: last.water, bloom: last.coffeeDose * 2, pours: [0, 0, last.water] } : { water: 480, bloom: 60, pours: [0, 0, 480] }}
                    poured={last ? last.water : 0}
                  />
                </div>
              </div>
              <div style={{ padding: "10px 18px 18px" }}>
                {last ? (
                  <>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: C.ink2, borderTop: `1px solid ${C.line}`, paddingTop: 14, marginBottom: 14 }}>
                      Förslaget från förra gången: {grindNote(last.roast, last.suggestedNext.grindOffset).toLowerCase()}, {last.suggestedNext.temperature} °C, 1:{last.suggestedNext.ratio}.
                    </div>
                    <Button
                      onClick={() =>
                        openSetup({
                          roast: last.roast,
                          inputMode: "dose",
                          dose: last.coffeeDose,
                          ratio: last.suggestedNext.ratio,
                          temperature: last.suggestedNext.temperature,
                          grindOffset: last.suggestedNext.grindOffset,
                          roastDate: last.roastDate || null,
                          bestBefore: last.bestBefore || null,
                        })
                      }
                    >
                      Fortsätt från förra
                    </Button>
                    <div style={{ height: 8 }} />
                    <Button variant="quiet" onClick={() => openSetup({ grindOffset: 0, temperature: ROASTS[cfg.roast].temp })}>
                      Ny bryggning från noll
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => openSetup({})}>Ny bryggning</Button>
                )}
              </div>
            </Card>
            {!loaded && <div style={{ fontSize: 13, color: C.ink3, marginTop: 12 }}>Läser in sparade bryggningar …</div>}
          </div>
        )}

        {/* ---------------- Setup ---------------- */}
        {screen === "setup" && (
          <Card>
            <Eyebrow>Steg 1 av 3 · Inställningar</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 18px", fontWeight: 400 }}>Vad brygger du?</h2>

            <div style={{ fontSize: 13, color: C.ink2, marginBottom: 8 }}>Rostnivå</div>
            {Object.values(ROASTS).map((r) => (
              <Choice
                key={r.key}
                label={r.label}
                sub={r.hint}
                selected={cfg.roast === r.key}
                onClick={() =>
                  setCfg((c) => ({ ...c, roast: r.key, temperature: clamp(c.temperature, r.tempMin, r.tempMax) === c.temperature ? clamp(c.temperature, r.tempMin, r.tempMax) : r.temp }))
                }
              />
            ))}

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>Mängd</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["dose", "Gram kaffe"], ["cups", "Antal koppar"]].map(([k, l]) => (
                <button
                  key={k}
                  className="cbc-btn"
                  onClick={() => setCfg((c) => ({ ...c, inputMode: k }))}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    fontSize: 13.5,
                    borderRadius: 3,
                    cursor: "pointer",
                    fontFamily: F.ui,
                    background: cfg.inputMode === k ? C.ink : "transparent",
                    color: cfg.inputMode === k ? C.card : C.ink2,
                    border: `1px solid ${cfg.inputMode === k ? C.ink : C.line}`,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {cfg.inputMode === "dose" ? (
              <>
                <Stepper
                  value={cfg.dose}
                  suffix="g kaffe"
                  min={12}
                  max={75}
                  step={1}
                  onChange={(v) => setCfg((c) => ({ ...c, dose: v }))}
                />
                {cfg.dose > 65 && (
                  <div style={{ fontSize: 12.5, color: C.hot, marginTop: 8, lineHeight: 1.45 }}>
                    Över 65 g blir kaffebädden djupare än 5 cm och extraktionen ojämn. Brygg hellre två omgångar.
                  </div>
                )}
              </>
            ) : (
              <>
                <Stepper
                  value={cfg.cups}
                  suffix={cfg.cups === 1 ? "kopp" : "koppar"}
                  min={1}
                  max={10}
                  step={1}
                  onChange={(v) => setCfg((c) => ({ ...c, cups: v }))}
                />
                <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8 }}>
                  Ger {doseFromCups(cfg.cups, cfg.ratio)} g kaffe. En kopp räknas som ca 170 ml färdigt kaffe.
                </div>
              </>
            )}

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>Ratio</div>
            <Stepper
              value={cfg.ratio}
              prefix="1:"
              min={13}
              max={19}
              step={1}
              onChange={(v) => setCfg((c) => ({ ...c, ratio: v }))}
            />
            <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8 }}>Lägre siffra ger starkare kaffe. 1:16 är utgångsläget.</div>

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>
              Rostdatum <span style={{ color: C.ink3 }}>— valfritt</span>
            </div>
            <input
              type="date"
              value={cfg.roastDate || ""}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCfg((c) => ({ ...c, roastDate: e.target.value || null }))}
              style={dateInput}
            />
            <div style={{ fontSize: 13, color: C.ink2, margin: "14px 0 8px" }}>
              Bäst före <span style={{ color: C.ink3 }}>— valfritt</span>
            </div>
            <input
              type="date"
              value={cfg.bestBefore || ""}
              onChange={(e) => setCfg((c) => ({ ...c, bestBefore: e.target.value || null }))}
              style={dateInput}
            />

            {(() => {
              const p = ageProfile(cfg.roast, cfg);
              if (!p)
                return (
                  <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 10, lineHeight: 1.45 }}>
                    Rostdatum står på de flesta påsar och är det säkra valet. Saknas det räknar appen baklänges från bäst före-datumet i stället. Med något av dem får du anpassad bloomtid och besked om när påsen är som bäst.
                  </div>
                );
              return (
                <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ background: "#fff", padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
                    <Eyebrow>Bäst att brygga{p.estimated ? " (uppskattat)" : ""}</Eyebrow>
                    <div style={{ fontFamily: F.display, fontSize: 20, margin: "6px 0 2px" }}>{p.sweet}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 12, color: p.key === "peak" ? C.ok : C.ink2 }}>{p.status}</div>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: p.tone === "warn" ? C.hot : C.ink2,
                    }}
                  >
                    <strong style={{ fontWeight: 600 }}>{p.label}.</strong> {p.note}
                    {p.expired && " Bäst före-datumet har dessutom passerat."}
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: 24 }}>
              <Button onClick={toRecipe}>Visa receptet</Button>
              <Button variant="plain" onClick={() => setScreen("home")} style={{ marginTop: 6 }}>
                Tillbaka
              </Button>
            </div>
          </Card>
        )}

        {/* ---------------- Receptöversikt ---------------- */}
        {screen === "recipe" && recipe && (
          <Card>
            <Eyebrow>Steg 2 av 3 · Recept</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 4px", fontWeight: 400 }}>
              {recipe.roastLabel}, {recipe.dose} g
            </h2>
            <div style={{ fontSize: 13.5, color: C.ink2, marginBottom: 16 }}>
              Väg upp allt innan du börjar. Klockan startar när bloomen gör det.
            </div>

            <Row label="Kaffe" value={`${recipe.dose} g`} />
            <Row label="Vatten" value={`${recipe.water} g`} />
            <Row label="Ratio" value={`1:${recipe.ratio}`} />
            <Row label="Temperatur" value={`${recipe.temperature} °C`} accent={C.hot} />
            <Row label="Malning" value={recipe.grindNote} />
            <Row
              label="Bloom"
              value={`${recipe.bloom} g, ${recipe.bloomSec} s`}
              accent={recipe.rest && recipe.rest.bloomDelta !== 0 ? C.collar : undefined}
            />
            {recipe.rest && (
              <>
                <Row
                  label={recipe.rest.estimated ? "Ålder (uppskattad)" : "Vila efter rost"}
                  value={`${recipe.rest.days} d — ${recipe.rest.label.toLowerCase()}`}
                  accent={recipe.rest.tone === "warn" ? C.hot : recipe.rest.tone === "ok" ? C.ok : C.ink}
                />
                <Row label="Bäst att brygga" value={recipe.rest.sweet} accent={recipe.rest.key === "peak" ? C.ok : C.ink3} />
                <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 10 }}>
                  {recipe.rest.note} {recipe.rest.status}
                </div>
              </>
            )}
            <Row label="Måltid" value={`${fmt(recipe.targetLo)}–${fmt(recipe.targetHi)}`} />

            <div style={{ marginTop: 22 }}>
              <Button onClick={startBrew}>Starta bryggningen</Button>
              <Button variant="plain" onClick={() => setScreen("setup")} style={{ marginTop: 6 }}>
                Ändra inställningar
              </Button>
            </div>
          </Card>
        )}

        {/* ---------------- Bryggningsläge ---------------- */}
        {screen === "brew" && recipe && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ marginLeft: -8, marginTop: -4 }}>
                  <BrewGauge recipe={recipe} poured={poured} />
                </div>
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <Eyebrow>Klocka</Eyebrow>
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 42,
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.02em",
                      lineHeight: 1.1,
                      marginTop: 4,
                      color: elapsed > recipe.targetHi ? C.hot : C.ink,
                    }}
                  >
                    {fmt(elapsed)}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 12, color: C.ink3, marginTop: 2 }}>
                    mål {fmt(recipe.targetLo)}–{fmt(recipe.targetHi)}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <Button variant="quiet" onClick={() => setRunning((r) => !r)} style={{ padding: "9px 0", fontSize: 13.5 }}>
                      {running ? "Pausa klockan" : elapsed === 0 ? "Starta klockan" : "Fortsätt"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <Eyebrow>
                Steg {stepIndex + 1} av {steps.length}
              </Eyebrow>
              <h2 style={{ fontFamily: F.display, fontSize: 24, margin: "8px 0 6px", fontWeight: 400 }}>{steps[stepIndex].title}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: C.ink2, margin: "0 0 14px" }}>{steps[stepIndex].detail}</p>

              {steps[stepIndex].target && (
                <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "12px 0", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13.5, color: C.ink2 }}>Häll till</span>
                  <span style={{ fontFamily: F.mono, fontSize: 28, fontVariantNumeric: "tabular-nums" }}>{steps[stepIndex].target} g</span>
                </div>
              )}

              <Button onClick={nextStep}>
                {stepIndex === steps.length - 1 ? "Bryggningen är klar" : "Klart – nästa steg"}
              </Button>

              <div style={{ marginTop: 16 }}>
                {steps.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                      padding: "5px 0",
                      opacity: i === stepIndex ? 1 : i < stepIndex ? 0.45 : 0.7,
                    }}
                  >
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: C.ink3, width: 34 }}>
                      {s.at !== undefined ? fmt(s.at) : "—"}
                    </span>
                    <span style={{ fontSize: 13.5, textDecoration: i < stepIndex ? "line-through" : "none" }}>{s.title}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ---------------- Feedback ---------------- */}
        {screen === "feedback" && recipe && (
          <Card>
            <Eyebrow>Steg 3 av 3 · Efter bryggningen</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 4px", fontWeight: 400 }}>Hur blev den?</h2>
            <div style={{ fontFamily: F.mono, fontSize: 12.5, color: C.ink2, marginBottom: 18 }}>
              {recipe.dose} g · 1:{recipe.ratio} · {recipe.temperature} °C · {fmt(actual)} mot mål {fmt(recipe.target)}
            </div>

            <div style={{ fontSize: 13, color: C.ink2, marginBottom: 8 }}>Smak</div>
            {Object.entries(TASTE).map(([k, l]) => (
              <Choice key={k} label={l[0].toUpperCase() + l.slice(1)} selected={fb.taste === k} onClick={() => setFb((f) => ({ ...f, taste: k }))} />
            ))}

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>Tid och flöde</div>
            {Object.entries(FLOW).map(([k, l]) => (
              <Choice
                key={k}
                label={k === "slow" ? "Gick långsamt" : k === "fast" ? "Gick snabbt" : "Bra tid"}
                sub={`Klockan säger ${l}`}
                selected={fb.flow === k}
                onClick={() => setFb((f) => ({ ...f, flow: k }))}
              />
            ))}

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>Anteckning, om du vill</div>
            <textarea
              value={fb.comment}
              onChange={(e) => setFb((f) => ({ ...f, comment: e.target.value }))}
              rows={3}
              placeholder="Nytt kaffe, kallt kök, hällde slarvigt …"
              style={{ width: "100%", padding: 12, fontSize: 14, border: `1px solid ${C.line}`, borderRadius: 3, background: "#fff", color: C.ink, resize: "vertical", boxSizing: "border-box" }}
            />

            <div style={{ marginTop: 20 }}>
              <Button onClick={saveFeedback} disabled={!fb.taste || !fb.flow}>
                Spara och få nästa förslag
              </Button>
              {(!fb.taste || !fb.flow) && (
                <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8, textAlign: "center" }}>Välj både smak och tid för att gå vidare.</div>
              )}
            </div>
          </Card>
        )}

        {/* ---------------- Nästa rekommendation ---------------- */}
        {screen === "next" && result && (
          <Card>
            <Eyebrow>Nästa bryggning</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 23, margin: "10px 0 12px", fontWeight: 400, lineHeight: 1.3 }}>
              {result.s.grindStep === 0 && result.s.temperature === result.recipe.temperature && result.s.ratio === result.recipe.ratio
                ? "Ändra ingenting."
                : "Så här justerar du."}
            </h2>

            <div style={{ marginBottom: 16 }}>
              {result.s.why.map((w, i) => (
                <p key={i} style={{ fontSize: 14.5, lineHeight: 1.6, color: C.ink2, margin: "0 0 8px" }}>
                  {w}
                </p>
              ))}
            </div>

            {changeList(result.recipe, result.s).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} accent={r.changed ? C.collar : C.ink3} />
            ))}
            <Row label="Ny malning" value={grindNote(result.recipe.roast, result.s.grindOffset)} />

            <div style={{ marginTop: 22 }}>
              <Button
                onClick={() =>
                  openSetup({
                    roast: result.recipe.roast,
                    inputMode: "dose",
                    dose: result.recipe.dose,
                    ratio: result.s.ratio,
                    temperature: result.s.temperature,
                    grindOffset: result.s.grindOffset,
                    roastDate: result.recipe.roastDate || null,
                    bestBefore: result.recipe.bestBefore || null,
                  })
                }
              >
                Använd förslaget
              </Button>
              <div style={{ height: 8 }} />
              <Button variant="quiet" onClick={() => setScreen("home")}>
                Klart för idag
              </Button>
            </div>
          </Card>
        )}

        {/* ---------------- Historik ---------------- */}
        {screen === "history" && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <Eyebrow>Historik</Eyebrow>
              <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 0", fontWeight: 400 }}>
                {brews.length} {brews.length === 1 ? "bryggning" : "bryggningar"}
              </h2>
            </Card>

            {brews.map((b) => (
              <Card key={b.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{ROASTS[b.roast].label}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.ink3 }}>
                    {new Date(b.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 12.5, color: C.ink2, marginTop: 8, lineHeight: 1.7 }}>
                  {b.coffeeDose} g · {b.water} g · 1:{b.ratio} · {b.temperature} °C
                  <br />
                  {b.grindNote} · {b.actualTime} mot mål {b.targetTime}
                  {b.restDays != null ? ` · ${b.restDays} d efter rost` : ""}
                </div>
                <div style={{ fontSize: 13.5, color: C.ink, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>
                  Blev {TASTE[b.feedback.taste]}, {FLOW[b.feedback.flow]}.
                  {b.feedback.comment ? ` ”${b.feedback.comment}”` : ""}
                </div>
                <div style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>
                  Nästa: {grindNote(b.roast, b.suggestedNext.grindOffset).toLowerCase()}, {b.suggestedNext.temperature} °C, 1:{b.suggestedNext.ratio}.
                </div>
              </Card>
            ))}

            <Button variant="quiet" onClick={() => setScreen("home")} style={{ marginTop: 6 }}>
              Till startsidan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Sifferväljare med tumvänliga knappar */
function Stepper({ value, onChange, min, max, step, prefix = "", suffix = "" }) {
  const btn = {
    width: 46,
    height: 46,
    borderRadius: 3,
    border: `1px solid ${C.line}`,
    background: "transparent",
    color: C.ink,
    fontSize: 20,
    cursor: "pointer",
    fontFamily: F.mono,
    lineHeight: 1,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button className="cbc-btn" style={btn} onClick={() => onChange(clamp(value - step, min, max))} aria-label="Minska">
        –
      </button>
      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: F.mono,
          fontSize: 24,
          fontVariantNumeric: "tabular-nums",
          border: `1px solid ${C.line}`,
          borderRadius: 3,
          padding: "9px 0",
          background: "#fff",
        }}
      >
        {prefix}
        {value}
        {suffix ? ` ${suffix}` : ""}
      </div>
      <button className="cbc-btn" style={btn} onClick={() => onChange(clamp(value + step, min, max))} aria-label="Öka">
        +
      </button>
    </div>
  );
}