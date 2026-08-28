import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { loadBrews, saveBrews } from "./lib/brews";
import { useAuth } from "./lib/useAuth";
import { signInWithGoogle, continueAsGuest, linkGuestToGoogle, signOut } from "./lib/firebase";
import { PALETTES, useTheme } from "./lib/theme";
import { translations, useLang } from "./lib/i18n";
import { METHODS, METHOD_ORDER } from "./lib/methods";
import { useMethod } from "./lib/method";
import { useAutoAdvance } from "./lib/autoAdvance";
import { pourTimes, timeWindow } from "./lib/methods/shared";
import { loadInProgress, saveInProgress, clearInProgress } from "./lib/inProgress";

/* ------------------------------------------------------------------ */
/*  Designtokens                                                       */
/* ------------------------------------------------------------------ */

// C holds CSS custom-property references, not literal colors — the actual
// values are injected by paletteVars() below and switched via [data-theme].
// Sub-components (Card, Button, Row, ...) read C.xxx exactly as before;
// only the string it resolves to at render time changes with the theme.
const C = Object.fromEntries(Object.keys(PALETTES.light).map((k) => [k, `var(--${k})`]));

function paletteVars(palette) {
  return Object.entries(palette)
    .map(([k, v]) => `--${k}: ${v};`)
    .join(" ");
}

const dateInput = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 15,
  border: `1px solid ${C.line}`,
  borderRadius: 3,
  background: C.card,
  color: C.ink,
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

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round5 = (v) => Math.round(v / 5) * 5;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.abs(Math.round(s % 60))).padStart(2, "0")}`;

function grindNote(methodKey, roastKey, offset, T) {
  const base = T.methods[methodKey].roastGrind[roastKey];
  if (offset === 0) return base;
  const steps = Math.abs(offset);
  const dir = offset > 0 ? T.next.coarser : T.next.finer;
  return T.grindNote(base, steps, dir);
}

function doseFromCups(cups, ratio) {
  // ~170 ml färdigt kaffe per kopp. Bädden håller kvar ca 2 g vatten per g kaffe.
  return clamp(Math.round((cups * 170) / (ratio - 2)), 12, 90);
}

/* Firebase raderar tysta, inaktiva gästkonton efter GUEST_CLEANUP_DAYS dagar
   (satt i Firebase Console — håll den här synkad med det värdet). Eftersom
   raderingen är permanent och sker utan förvarning, varnar hemskärmen aktivt
   den sista veckan innan den skulle inträffa, i stället för att bara nämna
   "skapa ett konto" som en trevlig idé. */
const GUEST_CLEANUP_DAYS = 30;
const GUEST_CLEANUP_WARNING_DAYS = 7;

function guestDaysLeft(creationTime) {
  if (!creationTime) return null;
  const days = Math.floor((Date.now() - new Date(creationTime).getTime()) / 86400000);
  return GUEST_CLEANUP_DAYS - days;
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

const shortDate = (d, T) => d.toLocaleDateString(T.locale, { day: "numeric", month: "short" });

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d;
}

/* Allt appen vet om påsens ålder, i ett objekt. Används både i setup och i
   receptet så att båda skärmarna säger exakt samma sak. */
function ageProfile(roastKey, cfg, T) {
  const stated = cfg.roastDate || null;
  const iso = stated || estimateRoastFromBestBefore(cfg.bestBefore);
  const days = daysSinceRoast(iso);
  if (days === null) return null;

  const estimated = !stated;
  const w = REST_WINDOWS[roastKey];
  const sweetFrom = addDays(iso, w.peak);
  const sweetTo = addDays(iso, w.fading - 1);
  const sweet = `${shortDate(sweetFrom, T)} – ${shortDate(sweetTo, T)}`;

  const status =
    days < w.peak
      ? T.rest.status.upcoming(T.rest.day(w.peak - days))
      : days < w.fading
      ? T.rest.status.now(T.rest.day(w.fading - days))
      : T.rest.status.past(T.rest.day(days - w.fading + 1));

  const age = T.rest.age(T.rest.day(days));
  const p =
    days < w.gassy
      ? { key: "fresh", bloomDelta: 20, tone: "warn", label: T.rest.label.fresh, note: T.rest.note.fresh(age) }
      : days < w.peak
      ? { key: "gassy", bloomDelta: 10, tone: "note", label: T.rest.label.gassy, note: T.rest.note.gassy(age) }
      : days < w.fading
      ? { key: "peak", bloomDelta: 0, tone: "ok", label: T.rest.label.peak, note: T.rest.note.peak(age) }
      : days < w.old
      ? { key: "fading", bloomDelta: -5, tone: "note", label: T.rest.label.fading, note: T.rest.note.fading(age) }
      : { key: "old", bloomDelta: -10, tone: "warn", label: T.rest.label.old, note: T.rest.note.old(age) };

  /* Uppskattade datum får inte styra lika hårt som ett avläst rostdatum. */
  const bloomDelta = estimated ? clamp(p.bloomDelta, -5, 10) : p.bloomDelta;

  return {
    ...p,
    days,
    bloomDelta,
    estimated,
    sweet,
    sweetFrom: sweetFrom.toISOString().slice(0, 10),
    status,
    expired: cfg.bestBefore ? new Date(`${cfg.bestBefore}T12:00:00`) < new Date() : false,
    note: estimated ? `${p.note}${T.rest.estimatedSuffix(SHELF_MONTHS)}` : p.note,
  };
}

function buildRecipe(method, cfg, T) {
  const dose = cfg.dose;
  const water = Math.round(dose * cfg.ratio);
  const bloom = round5(dose * 2);
  const [lo, hi] = timeWindow(method, cfg.roast, dose);
  const target = Math.round((lo + hi) / 2);
  const rest = ageProfile(cfg.roast, cfg, T);

  const [bloomMin, bloomMax] = method.bloomClamp;
  const bloomSec = clamp(method.bloomSeconds(dose) + (rest ? rest.bloomDelta : 0), bloomMin, bloomMax);
  const pours = method.pours(bloom, water);
  const lastPour = method.lastPourAt(target, bloomSec);

  return {
    method: method.key,
    roast: cfg.roast,
    roastLabel: T.roasts[cfg.roast].label,
    dose,
    water,
    ratio: cfg.ratio,
    temperature: cfg.temperature,
    grindOffset: cfg.grindOffset,
    grindNote: grindNote(method.key, cfg.roast, cfg.grindOffset, T),
    roastDate: cfg.roastDate || null,
    bestBefore: cfg.bestBefore || null,
    rest,
    bloom,
    bloomSec,
    pours,
    pourTimes: pourTimes(bloomSec, lastPour, pours.length),
    targetLo: lo,
    targetHi: hi,
    target,
  };
}

function buildSteps(method, r, T) {
  const mt = T.methods[method.key];
  const steps = [
    { id: "rinse", title: mt.steps.rinse.title, detail: mt.steps.rinse.detail },
    {
      id: "grind",
      title: T.steps.grind.title,
      detail: T.steps.grind.detail(r.dose, r.grindNote.toLowerCase(), r.temperature),
    },
    {
      id: "bloom",
      title: T.steps.bloom.title,
      detail: T.steps.bloom.detail(r.bloom, r.bloomSec),
      target: r.bloom,
      at: 0,
    },
  ];
  r.pours.forEach((g, i) => {
    const p = T.steps.pour(i + 1, r.pours.length);
    steps.push({ id: `p${i + 1}`, title: p.title, detail: p.detail(g), target: g, at: r.pourTimes[i] });
  });
  steps.push({
    id: "drawdown",
    title: mt.steps.drawdown.title,
    detail: mt.steps.drawdown.detail(fmt(r.targetLo), fmt(r.targetHi)),
    target: r.water,
  });
  return steps;
}

/* Regelmotorn: flödet styr malningen, smaken får temperatur och ratio. */
function suggest(recipe, fb, T) {
  const method = METHODS[recipe.method];
  const roast = method.ROASTS[recipe.roast];
  const roastLabel = T.roasts[recipe.roast].label.toLowerCase();
  let grind = 0;
  let temperature = recipe.temperature;
  let ratio = recipe.ratio;
  const why = [];

  // If the brewer already hand-adjusted the grind themselves, don't also
  // recommend a grind change on top of that — just note it happened.
  if (!fb.grindAdjusted) {
    if (fb.flow === "slow") grind = 1;
    if (fb.flow === "fast") grind = -1;
  } else if (fb.flow === "slow" || fb.flow === "fast") {
    why.push(T.suggest.grindAlreadyAdjusted);
  }

  if (fb.taste === "sour") {
    if (grind === 1) {
      const t = clamp(temperature + 1, roast.tempMin, roast.tempMax);
      if (t !== temperature) {
        temperature = t;
        why.push(T.suggest.sourGrindCoarserTempWarmer);
      } else {
        why.push(T.suggest.sourGrindCoarserTempMaxed(temperature, roastLabel));
      }
    } else if (grind === -1) {
      why.push(T.suggest.sourAlreadyFiner);
    } else {
      grind = -1;
      why.push(T.suggest.sourToFiner);
    }
  }

  if (fb.taste === "bitter") {
    if (grind === -1) {
      const t = clamp(temperature - 2, roast.tempMin, roast.tempMax);
      if (t !== temperature) {
        temperature = t;
        why.push(T.suggest.bitterGrindFinerTempCooler);
      } else {
        why.push(T.suggest.bitterGrindFinerTempMinned(temperature, roastLabel));
      }
    } else if (grind === 1) {
      why.push(T.suggest.bitterAlreadyCoarser);
    } else {
      grind = 1;
      why.push(T.suggest.bitterToCoarser);
    }
  }

  if (fb.taste === "weak") {
    ratio = clamp(ratio - 1, method.ratioRange.min, method.ratioRange.max);
    why.push(T.suggest.weak(ratio));
  }

  if (fb.taste === "strong") {
    ratio = clamp(ratio + 1, method.ratioRange.min, method.ratioRange.max);
    why.push(T.suggest.strong(ratio));
  }

  if (fb.taste === "balanced" && grind === 0) {
    why.push(T.suggest.balancedSame);
  } else if (fb.taste === "balanced") {
    why.push(T.suggest.balancedTimeOnly);
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
      why.push(T.suggest.freshSourOkA(rest.days));
      why.push(T.suggest.freshSourOkB);
    } else {
      why.push(T.suggest.freshSourOther(rest.days));
    }
  }

  if (rest && (rest.key === "fading" || rest.key === "old") && (fb.taste === "weak" || fb.taste === "sour")) {
    why.push(T.suggest.fadingOldWeakOrSour(rest.days));
  }

  return {
    grindOffset: clamp(recipe.grindOffset + grind, -6, 6),
    grindStep: grind,
    temperature,
    ratio,
    why,
  };
}

function changeList(recipe, s, T) {
  const rows = [];
  rows.push({
    label: T.recipe.grind,
    value: s.grindStep === 0 ? T.next.unchanged : T.next.grindStep(s.grindStep > 0 ? T.next.coarser : T.next.finer),
    changed: s.grindStep !== 0,
  });
  rows.push({
    label: T.recipe.temperature,
    value: s.temperature === recipe.temperature ? T.next.tempUnchanged(s.temperature) : `${recipe.temperature} → ${s.temperature} °C`,
    changed: s.temperature !== recipe.temperature,
  });
  rows.push({
    label: T.setup.ratio,
    value: s.ratio === recipe.ratio ? T.next.ratioUnchanged(s.ratio) : `1:${recipe.ratio} → 1:${s.ratio}`,
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

function Button({ children, onClick, variant = "primary", disabled, style, className = "" }) {
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
    danger: { background: C.hot, color: C.card, border: `1px solid ${C.hot}` },
  };
  return (
    <button
      className={`cbc-btn ${className}`.trim()}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...skins[variant], ...style }}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="cbc-btn"
      style={{
        flexShrink: 0,
        width: 44,
        height: 26,
        borderRadius: 13,
        border: `1px solid ${checked ? C.ink : C.line}`,
        background: checked ? C.ink : "transparent",
        position: "relative",
        cursor: "pointer",
        padding: 0,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 21 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: checked ? C.card : C.ink3,
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}

function ConfirmDialog({ message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 10,
      }}
      onClick={onCancel}
    >
      <div style={{ width: "100%", maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <Card>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: C.ink, marginBottom: 20 }}>{message}</div>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <div style={{ height: 8 }} />
          <Button variant="quiet" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function EditFeedbackDialog({ T, fb, setFb, onSave, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 10,
        overflowY: "auto",
      }}
      onClick={onCancel}
    >
      <div style={{ width: "100%", maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <Card>
          <h2 style={{ fontFamily: F.display, fontSize: 20, margin: "0 0 14px", fontWeight: 400 }}>{T.home.editFeedback}</h2>

          <div style={{ fontSize: 13, color: C.ink2, marginBottom: 8 }}>{T.feedback.taste}</div>
          {Object.entries(T.taste).map(([k, l]) => (
            <Choice key={k} label={l[0].toUpperCase() + l.slice(1)} selected={fb.taste === k} onClick={() => setFb((f) => ({ ...f, taste: k }))} />
          ))}

          <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>{T.feedback.timeAndFlow}</div>
          {Object.entries(T.flow).map(([k, l]) => (
            <Choice
              key={k}
              label={k === "slow" ? T.feedback.wentSlow : k === "fast" ? T.feedback.wentFast : T.feedback.goodTime}
              sub={T.feedback.clockSays(l)}
              selected={fb.flow === k}
              onClick={() => setFb((f) => ({ ...f, flow: k }))}
            />
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "18px 0 8px" }}>
            <span style={{ fontSize: 13, color: C.ink2 }}>{T.feedback.grindAdjusted}</span>
            <Toggle checked={!!fb.grindAdjusted} onChange={() => setFb((f) => ({ ...f, grindAdjusted: !f.grindAdjusted }))} />
          </div>

          <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>{T.feedback.noteLabel}</div>
          <textarea
            value={fb.comment}
            onChange={(e) => setFb((f) => ({ ...f, comment: e.target.value }))}
            rows={3}
            placeholder={T.feedback.notePlaceholder}
            style={{ width: "100%", padding: 12, fontSize: 14, border: `1px solid ${C.line}`, borderRadius: 3, background: C.card, color: C.ink, resize: "vertical", boxSizing: "border-box" }}
          />

          <div style={{ marginTop: 20 }}>
            <Button onClick={onSave} disabled={!fb.taste || !fb.flow}>
              {T.feedback.save}
            </Button>
            <div style={{ height: 8 }} />
            <Button variant="quiet" onClick={onCancel}>
              {T.confirm.cancel}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SourcesDialog({ title, intro, sources, closeLabel, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div style={{ width: "100%", maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <Card>
          <div style={{ fontFamily: F.display, fontSize: 19, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.5, marginBottom: 16 }}>{intro}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {sources.map((s) => (
              <li key={s.url} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.line}` }}>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: C.ink, fontSize: 13.5, lineHeight: 1.4 }}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <div style={{ height: 6 }} />
          <Button variant="quiet" onClick={onClose}>
            {closeLabel}
          </Button>
        </Card>
      </div>
    </div>
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
        <div style={{ fontSize: 12.5, marginTop: 3, color: selected ? C.card : C.ink3, opacity: selected ? 0.72 : 1, lineHeight: 1.4 }}>
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

/* Gramskalans märken kan hamna nära varandra (t.ex. bloom nära en liten
   hällning, eller flera märken på samma värde), vilket gör etiketterna
   svåra att läsa. Slår ihop dubbletter och sprider isär resten tills alla
   har minst MIN_LABEL_GAP mellan sig, sedan flyttas hela gruppen tillbaka
   in om den svämmade över kant. */
const MIN_LABEL_GAP = 12;

function declutterMarks(marks, water, top, bottom) {
  const byValue = new Map(marks.map((m) => [m.g, m]));
  const positioned = [...byValue.values()]
    .map((m) => ({ ...m, y: bottom - clamp(m.g / water, 0, 1) * (bottom - top) }))
    .sort((a, b) => a.y - b.y);

  for (let i = 1; i < positioned.length; i++) {
    positioned[i].y = Math.max(positioned[i].y, positioned[i - 1].y + MIN_LABEL_GAP);
  }
  const overflow = positioned.length ? positioned[positioned.length - 1].y - bottom : 0;
  if (overflow > 0) {
    for (const m of positioned) m.y -= overflow;
  }
  return positioned;
}

/* Signaturen: bryggarens silhuett som nivåmätare med gramskala. Formen och
   dekoren (Chemex-krage, V60-ribbor, ...) kommer från method.gauge, så nya
   metoder ritar sig själva utan att röra den här komponenten. */
function BrewGauge({ methodKey, recipe, poured }) {
  const g = METHODS[methodKey].gauge;
  const mx = g.marksX || { tick1: 84, tick2: 96, label: 100 };
  const frac = clamp(poured / recipe.water, 0, 1);
  const fillY = g.bottom - frac * (g.bottom - g.top);
  const marks = [{ g: recipe.bloom, l: "bloom" }, ...recipe.pours.map((v, i) => ({ g: v, l: String(i + 1) }))];
  return (
    <svg viewBox={g.viewBox} style={{ width: g.width, height: g.height, display: "block" }} aria-hidden="true">
      <defs>
        <clipPath id="cbc-glass">
          <path d={g.glassPath} />
        </clipPath>
      </defs>
      <path d={g.glassPath} fill="#FFFFFF" stroke={C.line} strokeWidth="1.5" />
      <g clipPath="url(#cbc-glass)">
        <rect x="0" y={fillY} width="100" height={g.bottom - fillY + 8} fill={C.brew} style={{ transition: "y 400ms ease" }} />
      </g>
      {g.decor.map((d, i) =>
        d.path ? (
          <path
            key={i}
            d={d.path}
            fill={d.fillToken ? C[d.fillToken] : d.fill || "none"}
            stroke={d.stroke}
            strokeWidth={d.stroke ? d.strokeWidth || 1.2 : undefined}
            strokeLinejoin="round"
          />
        ) : (
          <line
            key={i}
            x1={d.line.x1}
            y1={d.line.y1}
            x2={d.line.x2}
            y2={d.line.y2}
            stroke={d.stroke}
            strokeWidth={d.strokeWidth || 1.2}
            strokeLinecap="round"
          />
        )
      )}
      {declutterMarks(marks, recipe.water, g.top, g.bottom).map((m) => (
        <g key={m.l}>
          <line x1={mx.tick1} y1={m.y} x2={mx.tick2} y2={m.y} stroke={poured >= m.g ? C.ink : C.line} strokeWidth="1" />
          <text x={mx.label} y={m.y + 3.5} fill={poured >= m.g ? C.ink : C.ink3} fontFamily={F.mono} fontSize="9.5">
            {m.g} g
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Appen                                                              */
/* ------------------------------------------------------------------ */

export default function ChemexBrewCoach() {
  const user = useAuth();
  const [theme, setTheme] = useTheme();
  const [lang, setLang] = useLang();
  const T = translations[lang];
  const [method, setMethod] = useMethod();
  const activeMethod = METHODS[method];
  const [authError, setAuthError] = useState(null);
  const [linkError, setLinkError] = useState(null);

  function handleCreateAccount() {
    setLinkError(null);
    linkGuestToGoogle().catch((err) => {
      setLinkError(err.code === "auth/credential-already-in-use" ? T.auth.credentialInUse : T.auth.linkFailed(err.message || String(err)));
    });
  }
  const [confirmAction, setConfirmAction] = useState(null);
  const [showSources, setShowSources] = useState(false);
  const [screen, setScreen] = useState("home");

  // Wires the phone's back button/gesture into screen navigation instead of
  // it just exiting the installed app. Each forward navigation pushes a
  // history entry; going back pops one, and the popstate handler below
  // syncs `screen` to match — so back retraces exactly the path taken,
  // and pressing back from the home screen (nothing left to pop) falls
  // through to whatever the browser would normally do, i.e. exit/close.
  function goTo(next) {
    window.history.pushState({ screen: next }, "");
    setScreen(next);
    window.scrollTo(0, 0);
  }

  // Switching method resets the in-progress setup fields to that method's
  // own defaults — a Chemex dose/ratio can sit outside a V60's sane range,
  // so there's nothing sensible to carry over. Roast, roast date and
  // best-before describe the coffee, not the method, so those stay put.
  // While the clock is running this counts as leaving an ongoing brew, so
  // it's gated behind the same abort confirmation as goHome/back below.
  function handleMethodChange(nextKey) {
    function apply() {
      const m = METHODS[nextKey];
      setRunning(false);
      setMethod(nextKey);
      setCfg((c) => ({
        ...c,
        dose: m.doseRange.default,
        ratio: m.ratioRange.default,
        temperature: m.ROASTS[c.roast].temp,
        grindOffset: 0,
      }));
      goTo("home");
    }
    if (running) {
      setConfirmAction({
        message: T.confirm.abortBrew,
        confirmLabel: T.confirm.abortBrewConfirm,
        danger: true,
        onConfirm: () => {
          if (recipe) {
            clearInProgress(recipe.method);
            setInProgress(null);
          }
          apply();
        },
      });
      return;
    }
    apply();
  }

  // Leaving an ongoing brew (clock running) always asks for confirmation —
  // confirming aborts it for good (the saved in-progress snapshot for this
  // method is cleared too, so there's nothing left to resume). Leaving a
  // paused brew, or one that hasn't started ticking yet, needs no prompt:
  // the in-progress effect below keeps it saved automatically, resumable
  // later from the "Continue X Brew" card on Home.
  function goHome() {
    if (running) {
      setConfirmAction({
        message: T.confirm.abortBrew,
        confirmLabel: T.confirm.abortBrewConfirm,
        danger: true,
        onConfirm: () => {
          setRunning(false);
          if (recipe) {
            clearInProgress(recipe.method);
            setInProgress(null);
          }
          goTo("home");
        },
      });
      return;
    }
    goTo("home");
  }

  useEffect(() => {
    window.history.replaceState({ screen: "home" }, "");
  }, []);

  const [loaded, setLoaded] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [brews, setBrews] = useState([]);

  const [cfg, setCfg] = useState(() => ({
    roast: "light",
    inputMode: "dose",
    dose: activeMethod.doseRange.default,
    cups: 2,
    ratio: activeMethod.ratioRange.default,
    temperature: activeMethod.ROASTS.light.temp,
    grindOffset: 0,
    roastDate: null,
    bestBefore: null,
  }));
  const [recipe, setRecipe] = useState(null);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [fb, setFb] = useState({ taste: null, flow: null, comment: "" });
  const [actual, setActual] = useState(0);
  const [result, setResult] = useState(null);
  // Editing a past brew's taste answer (from Home's latest-brew card, or a
  // pending "svara senare" review) — separate from the live `fb`/`recipe`
  // state, which belongs to the brew actually in progress right now.
  const [editingBrew, setEditingBrew] = useState(null);
  const [editFb, setEditFb] = useState({ taste: null, flow: null, comment: "" });
  // Set when "Fortsätt från förra" is used on a brew with a pending taste
  // review — the review has to be filled in before continuing is allowed,
  // so saving the edit then proceeds straight into Setup afterward.
  const [continueAfterEdit, setContinueAfterEdit] = useState(false);
  const tick = useRef(null);
  const [autoAdvance, setAutoAdvance] = useAutoAdvance();
  const [autoAdvancePending, setAutoAdvancePending] = useState(false);
  const autoAdvanceTimer = useRef(null);
  const autoAdvanceFiredFor = useRef(-1);

  // The brew currently underway for this method, if any — past Setup, with
  // a built recipe. Kept in sync with localStorage (see the effect below)
  // rather than re-read on every access, so the Home screen's "Continue X
  // Brew" card updates immediately on save/clear/method-switch.
  const [inProgress, setInProgress] = useState(() => loadInProgress(method));

  useEffect(() => {
    setInProgress(loadInProgress(method));
  }, [method]);

  // Once a recipe exists, the brew is worth resuming — auto-save it under
  // this method's own slot on every change (including every clock tick)
  // so switching methods, or just closing the app, never loses it. Setup
  // alone (no recipe yet) isn't saved: it's just a form, cheap to redo.
  useEffect(() => {
    if (!recipe || !["recipe", "brew", "feedback"].includes(screen)) return;
    const snapshot = { screen, recipe, steps, stepIndex, elapsed, running, fb, actual };
    saveInProgress(recipe.method, snapshot);
    setInProgress(snapshot);
  }, [screen, recipe, steps, stepIndex, elapsed, running, fb, actual]);

  function resumeInProgress() {
    if (!inProgress) return;
    const r = inProgress.recipe;
    // Restore cfg to match the resumed recipe, so if the user backs out to
    // Setup it shows the settings that actually produced this brew instead
    // of whatever cfg happened to be left over from something else.
    setCfg((c) => ({
      ...c,
      roast: r.roast,
      inputMode: "dose",
      dose: r.dose,
      ratio: r.ratio,
      temperature: r.temperature,
      grindOffset: r.grindOffset,
      roastDate: r.roastDate,
      bestBefore: r.bestBefore,
    }));
    setRecipe(r);
    setSteps(inProgress.steps);
    setStepIndex(inProgress.stepIndex);
    setElapsed(inProgress.elapsed);
    setRunning(false);
    setFb(inProgress.fb);
    setActual(inProgress.actual);

    // Resuming jumps straight to wherever the brew was left, but "back"
    // (the hardware gesture, Setup's "Tillbaka", Recipe's "Ändra
    // inställningar") should still retrace the normal setup → recipe →
    // brew → feedback path rather than landing straight back on Home.
    // Push the skipped screens first so the history stack matches what a
    // normal forward walk through the flow would have produced.
    const path = { recipe: ["setup"], brew: ["setup", "recipe"], feedback: ["setup", "recipe", "brew"] }[inProgress.screen] || [];
    path.forEach((s) => window.history.pushState({ screen: s }, ""));
    goTo(inProgress.screen);
  }

  // While a brew's clock is running, a back-navigation shouldn't silently
  // abort it. We can't cancel a popstate after the fact, so instead we
  // immediately re-push the "brew" entry to undo the browser's move (net
  // effect: the URL/stack end up exactly as before) and ask for confirmation.
  // Confirming clears this method's in-progress snapshot too — an aborted
  // brew has nothing left to resume — then sets this ref so the resulting
  // programmatic back() is let through instead of being caught again.
  const bypassBackGuardRef = useRef(false);

  useEffect(() => {
    function onPopState(e) {
      const next = e.state?.screen || "home";
      if (running && !bypassBackGuardRef.current) {
        window.history.pushState({ screen: "brew" }, "");
        setConfirmAction({
          message: T.confirm.abortBrew,
          confirmLabel: T.confirm.abortBrewConfirm,
          danger: true,
          onConfirm: () => {
            setRunning(false);
            if (recipe) {
              clearInProgress(recipe.method);
              setInProgress(null);
            }
            bypassBackGuardRef.current = true;
            window.history.back();
          },
        });
        return;
      }
      bypassBackGuardRef.current = false;
      setScreen(next);
      window.scrollTo(0, 0);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [running, T, recipe]);

  /* Ladda sparade bryggningar från Firestore */
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setBrews(await loadBrews(user.uid));
      } catch (e) {
        /* inget sparat än */
      }
      setLoaded(true);
    })();
  }, [user]);

  async function persist(next) {
    setBrews(next);
    try {
      const ok = await saveBrews(user.uid, next);
      setSaveFailed(!ok);
    } catch (e) {
      setSaveFailed(true);
    }
  }

  async function removeBrew(id) {
    await persist(brews.filter((b) => b.id !== id));
  }

  // Only clears the current method's brews — keeps everything belonging
  // to the other method untouched.
  async function clearAllBrews() {
    await persist(brews.filter((b) => (b.method || "chemex") !== method));
  }

  /* Klocka */
  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(tick.current);
    }
  }, [running]);

  // Resets whenever the step changes, whether that happened manually or via
  // the auto-advance timer below, so each step gets its own fresh countdown.
  useEffect(() => {
    autoAdvanceFiredFor.current = -1;
    setAutoAdvancePending(false);
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, [stepIndex]);

  // Pausing the clock cancels a pending auto-advance rather than letting it
  // fire while the brewer isn't actually watching the timer.
  useEffect(() => {
    if (!running && autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
      autoAdvanceFiredFor.current = -1;
      setAutoAdvancePending(false);
    }
  }, [running]);

  useEffect(() => {
    if (!running || !autoAdvance || screen !== "brew") return;
    const nextAt = steps[stepIndex + 1]?.at;
    if (nextAt === undefined) return;
    if (elapsed < nextAt) return;
    if (autoAdvanceFiredFor.current === stepIndex) return;
    autoAdvanceFiredFor.current = stepIndex;
    setAutoAdvancePending(true);
    autoAdvanceTimer.current = setTimeout(() => {
      autoAdvanceTimer.current = null;
      setAutoAdvancePending(false);
      nextStep();
    }, 0);
  }, [elapsed, running, autoAdvance, stepIndex, steps, screen]);

  /* Håll <html lang>, bläddarfliken och adressfältets temafärg i synk med valen ovan */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${activeMethod.label} ${T.brandSuffix}`;
  }, [lang, method]);

  // useLayoutEffect, not useEffect: this needs to land before the browser
  // paints, or there's a flash of the wrong theme on <html> on first load.
  useLayoutEffect(() => {
    // On <html> rather than only the inner shell div: custom properties only
    // cascade to descendants, and <body> — never styled by this component,
    // so it keeps the browser's default white background — sits *above*
    // the shell div in the tree. Theming html covers body too, closing the
    // white frame that showed around the app (worst in dark mode, where the
    // default white body was most visible against everything else).
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", PALETTES[theme].ink);
  }, [theme]);

  const shell = {
    minHeight: "100vh",
    background: C.paper,
    color: C.ink,
    fontFamily: F.ui,
    padding: "22px 16px 40px",
    display: "flex",
    justifyContent: "center",
  };

  const styleTag = (
    <style>{`
      :root { ${paletteVars(PALETTES.light)} }
      [data-theme="dark"] { ${paletteVars(PALETTES.dark)} }
      html, body { margin: 0; background: ${C.paper}; }
      .cbc-btn:focus-visible { outline: 2px solid ${C.collar}; outline-offset: 2px; }
      .cbc-btn:hover:not(:disabled) { filter: brightness(1.06); }
      input, textarea { font-family: ${F.mono}; }
      input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.collar}; outline-offset: 1px; }
      @keyframes cbc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      .cbc-pulse { animation: cbc-pulse 900ms ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } .cbc-pulse { animation: none !important; } }
    `}</style>
  );

  const navBtnStyle = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: F.mono,
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: C.ink2,
  };

  const methodSelect = (
    <select
      className="cbc-btn"
      aria-label={T.chooseMethod}
      value={method}
      onChange={(e) => handleMethodChange(e.target.value)}
      style={{
        marginTop: 4,
        fontFamily: F.mono,
        fontSize: 12,
        letterSpacing: "0.04em",
        color: C.ink2,
        background: "transparent",
        border: `1px solid ${C.line}`,
        borderRadius: 3,
        padding: "3px 6px",
        cursor: "pointer",
      }}
    >
      {METHOD_ORDER.map((k) => (
        <option key={k} value={k}>
          {METHODS[k].label}
        </option>
      ))}
    </select>
  );

  const langThemeToggles = (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 12 }}>
      <button className="cbc-btn" onClick={() => setLang(lang === "sv" ? "en" : "sv")} style={navBtnStyle}>
        {T.lang[lang === "sv" ? "en" : "sv"]}
      </button>
      <button className="cbc-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={navBtnStyle}>
        {T.theme[theme === "light" ? "dark" : "light"]}
      </button>
    </div>
  );

  if (user === undefined) {
    return (
      <div style={shell} data-theme={theme}>
        {styleTag}
        <div style={{ fontFamily: F.mono, fontSize: 13, color: C.ink3 }}>{T.loggingIn}</div>
      </div>
    );
  }

  if (user === null) {
    return (
      <div style={shell} data-theme={theme}>
        {styleTag}
        <div style={{ width: "100%", maxWidth: 460 }}>
          {langThemeToggles}
          <Card style={{ textAlign: "center", padding: "44px 24px" }}>
            <div style={{ fontFamily: F.display, fontSize: 24, marginBottom: 8 }}>{activeMethod.label} {T.brandSuffix}</div>
            <div style={{ fontSize: 14, color: C.ink2, marginBottom: 26, lineHeight: 1.5 }}>{T.auth.prompt}</div>
            {authError && (
              <div style={{ border: `1px solid ${C.hot}`, color: C.hot, padding: "10px 12px", fontSize: 13, marginBottom: 18, borderRadius: 3, textAlign: "left" }}>
                {T.auth.failed(authError)}
              </div>
            )}
            <Button
              onClick={() => {
                setAuthError(null);
                signInWithGoogle().catch((err) => setAuthError(err.message || String(err)));
              }}
            >
              {T.auth.signIn}
            </Button>
            <div style={{ height: 8 }} />
            <Button
              variant="quiet"
              onClick={() => {
                setAuthError(null);
                continueAsGuest().catch((err) => setAuthError(err.message || String(err)));
              }}
            >
              {T.auth.continueAsGuest}
            </Button>
            <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 10, lineHeight: 1.4 }}>{T.auth.guestCaption}</div>
          </Card>
        </div>
      </div>
    );
  }

  // Chemex and V60 keep fully separate history: the home screen's "last
  // brew" card, the history count/list, and clearing history all only ever
  // see brews made with the currently selected method. Brews saved before
  // method-tracking existed have no .method field and are treated as
  // Chemex, matching what the app only ever brewed at the time.
  const methodBrews = brews.filter((b) => (b.method || "chemex") === method);
  const last = methodBrews[0] || null;

  /* --- flödeshjälpare --- */

  // methodKey lets a "continue from"/"use suggestion" shortcut reopen setup
  // under whichever method that source brew actually used, rather than
  // whatever the dropdown currently happens to be on.
  function openSetup(prefill, methodKey) {
    if (methodKey && methodKey !== method) setMethod(methodKey);
    setCfg((c) => ({ ...c, ...prefill }));
    goTo("setup");
  }

  // "Ny bryggning från noll" starts over completely — worth confirming when
  // there's an unfinished brew for this method, since it'll be left behind.
  function startNewFromZero() {
    const goFresh = () => openSetup({ grindOffset: 0, temperature: activeMethod.ROASTS[cfg.roast].temp });
    if (inProgress) {
      setConfirmAction({
        message: T.confirm.startNewWhileInProgress,
        confirmLabel: T.home.newFromZero,
        danger: true,
        onConfirm: goFresh,
      });
    } else {
      goFresh();
    }
  }

  function toRecipe() {
    const dose = cfg.inputMode === "dose" ? cfg.dose : doseFromCups(cfg.cups, cfg.ratio);
    const r = buildRecipe(activeMethod, { ...cfg, dose }, T);
    setRecipe(r);
    setSteps(buildSteps(activeMethod, r, T));
    goTo("recipe");
  }

  function startBrew() {
    setStepIndex(0);
    setElapsed(0);
    setRunning(false);
    autoAdvanceFiredFor.current = -1;
    setAutoAdvancePending(false);
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    goTo("brew");
  }

  function nextStep() {
    const cur = steps[stepIndex];
    if (cur.id === "grind") setRunning(true); // klockan startar när bloomen börjar
    if (stepIndex === steps.length - 1) {
      setRunning(false);
      const [lo, hi] = [recipe.targetLo, recipe.targetHi];
      setActual(elapsed);
      setFb({ taste: null, flow: elapsed > hi ? "slow" : elapsed < lo ? "fast" : "ok", comment: "" });
      goTo("feedback");
      return;
    }
    setStepIndex((i) => i + 1);
  }

  async function saveFeedback(pending) {
    // "Svara senare": skip taste for now — flow/time feedback (already set
    // automatically when the brew finished) still drives a partial
    // suggestion, and the pending flag lets Home/History prompt for the
    // taste answer later via editFeedback().
    const fbToSave = pending ? { ...fb, taste: null, pending: true } : { ...fb, pending: false };
    const s = suggest(recipe, fbToSave, T);
    const brew = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      method: recipe.method,
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
      feedback: fbToSave,
      suggestedNext: { grindOffset: s.grindOffset, temperature: s.temperature, ratio: s.ratio },
    };
    setResult({ recipe, s });
    clearInProgress(recipe.method);
    setInProgress(null);
    await persist([brew, ...brews].slice(0, 60));
    goTo(pending ? "home" : "next");
  }

  function editFeedback(brew, continueAfter) {
    setEditingBrew(brew);
    setEditFb({
      taste: brew.feedback.taste,
      flow: brew.feedback.flow,
      comment: brew.feedback.comment || "",
      grindAdjusted: brew.feedback.grindAdjusted || false,
    });
    setContinueAfterEdit(!!continueAfter);
  }

  async function saveEditFeedback() {
    // rest (roast-freshness data) isn't stored on a saved brew, so the
    // freshness-aware override in suggest() simply won't re-fire here —
    // acceptable for a retroactive edit.
    const pseudoRecipe = {
      method: editingBrew.method,
      roast: editingBrew.roast,
      grindOffset: editingBrew.grindOffset,
      temperature: editingBrew.temperature,
      ratio: editingBrew.ratio,
      rest: null,
    };
    const s = suggest(pseudoRecipe, editFb, T);
    const updated = {
      ...editingBrew,
      feedback: { ...editFb, pending: false },
      suggestedNext: { grindOffset: s.grindOffset, temperature: s.temperature, ratio: s.ratio },
    };
    await persist(brews.map((b) => (b.id === editingBrew.id ? updated : b)));
    setEditingBrew(null);
    if (continueAfterEdit) {
      setContinueAfterEdit(false);
      openSetup(
        {
          roast: updated.roast,
          inputMode: "dose",
          dose: updated.coffeeDose,
          ratio: updated.suggestedNext.ratio,
          temperature: updated.suggestedNext.temperature,
          grindOffset: updated.suggestedNext.grindOffset,
          roastDate: updated.roastDate || null,
          bestBefore: updated.bestBefore || null,
        },
        updated.method || "chemex"
      );
    }
  }

  const poured = (() => {
    if (!recipe) return 0;
    const done = steps.slice(0, stepIndex).filter((s) => s.target);
    return done.length ? done[done.length - 1].target : 0;
  })();

  // When the current step has a known target time (the point the next step
  // should begin), the clock warns as that moment approaches: orange inside
  // 10s, red once it's passed. Untimed steps (rinse, grind, drawdown) keep
  // the plain ink color.
  const nextStepAt = steps[stepIndex + 1]?.at;
  const timeToNextStep = nextStepAt !== undefined ? nextStepAt - elapsed : null;
  const clockColor =
    (recipe && elapsed > recipe.targetHi) || (timeToNextStep !== null && timeToNextStep <= 0)
      ? C.hot
      : timeToNextStep !== null && timeToNextStep <= 10
      ? C.warn
      : C.ink;

  const inProgressPoured = (() => {
    if (!inProgress) return 0;
    const done = inProgress.steps.slice(0, inProgress.stepIndex).filter((s) => s.target);
    return done.length ? done[done.length - 1].target : 0;
  })();

  /* ------------------------------------------------------------------ */

  return (
    <div style={shell} data-theme={theme}>
      {styleTag}
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          cancelLabel={T.confirm.cancel}
          danger={confirmAction.danger}
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {editingBrew && (
        <EditFeedbackDialog
          T={T}
          fb={editFb}
          setFb={setEditFb}
          onSave={saveEditFeedback}
          onCancel={() => {
            setEditingBrew(null);
            setContinueAfterEdit(false);
          }}
        />
      )}
      {showSources && (
        <SourcesDialog
          title={T.sources.title}
          intro={T.sources.intro(activeMethod.label)}
          sources={activeMethod.sources}
          closeLabel={T.sources.close}
          onClose={() => setShowSources(false)}
        />
      )}

      <div style={{ width: "100%", maxWidth: 460 }}>
        {/* Sidhuvud — en fast 2×2-indelning (titel/dropdown till vänster,
            snabbval/kontoåtgärder till höger på samma två rader) i stället
            för flytande radbrytning, så layouten alltid ser likadan ut
            oavsett hur bred den aktuella metodens namn råkar vara. */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              className="cbc-btn"
              onClick={goHome}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ fontFamily: F.display, fontSize: 21, letterSpacing: "-0.01em", color: C.ink, whiteSpace: "nowrap", flexShrink: 0 }}>
                {activeMethod.label} {T.brandSuffix}
              </div>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <button className="cbc-btn" onClick={() => setLang(lang === "sv" ? "en" : "sv")} style={navBtnStyle}>
                {T.lang[lang === "sv" ? "en" : "sv"]}
              </button>
              <button className="cbc-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={navBtnStyle}>
                {T.theme[theme === "light" ? "dark" : "light"]}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14}}>
              {methodSelect}
              <button
                className="cbc-btn"
                onClick={() => setShowSources(true)}
                aria-label={T.sources.title}
                title={T.sources.title}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `1px solid ${C.line}`,
                  background: "transparent",
                  color: C.ink3,
                  fontFamily: F.display,
                  fontSize: 13,
                  fontStyle: "italic",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                i
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              {methodBrews.length > 0 && screen !== "history" && (
                <button className="cbc-btn" onClick={() => goTo("history")} style={navBtnStyle}>
                  {T.historyNav(methodBrews.length)}
                </button>
              )}
              <button
                className="cbc-btn"
                onClick={() =>
                  setConfirmAction({
                    message: user.isAnonymous ? T.confirm.signOutGuest : T.confirm.signOut,
                    confirmLabel: T.signOut,
                    danger: user.isAnonymous,
                    onConfirm: () => signOut(),
                  })
                }
                title={user.email || undefined}
                style={{ ...navBtnStyle, color: C.ink3 }}
              >
                {T.signOut}
              </button>
            </div>
          </div>
        </div>

        {saveFailed && (
          <div style={{ border: `1px solid ${C.hot}`, color: C.hot, padding: "10px 12px", fontSize: 13, marginBottom: 14, borderRadius: 3 }}>
            {T.saveFailed}
          </div>
        )}

        {/* ---------------- Startsida ---------------- */}
        {screen === "home" && (
          <div>
            {user.isAnonymous &&
              (() => {
                const daysLeft = guestDaysLeft(user.metadata.creationTime);
                const urgent = daysLeft !== null && daysLeft <= GUEST_CLEANUP_WARNING_DAYS;
                return (
                  <Card style={{ marginBottom: 12, borderColor: urgent ? C.hot : undefined }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5, color: urgent ? C.hot : C.ink2, marginBottom: 12 }}>
                      {urgent ? T.auth.guestCleanupWarning(Math.max(daysLeft, 0)) : T.auth.guestHint}
                    </div>
                    {linkError && (
                      <div style={{ border: `1px solid ${C.hot}`, color: C.hot, padding: "10px 12px", fontSize: 13, marginBottom: 12, borderRadius: 3 }}>
                        {linkError}
                      </div>
                    )}
                    <Button onClick={handleCreateAccount}>{T.auth.createAccount}</Button>
                  </Card>
                );
              })()}
            {inProgress && (
              <Card style={{ padding: 0, overflow: "hidden", marginBottom: 12, position: "relative" }}>
                <button
                  className="cbc-btn"
                  onClick={() =>
                    setConfirmAction({
                      message: T.confirm.abortBrew,
                      confirmLabel: T.confirm.abortBrewConfirm,
                      danger: true,
                      onConfirm: () => {
                        clearInProgress(inProgress.recipe.method);
                        setInProgress(null);
                      },
                    })
                  }
                  aria-label={T.confirm.abortBrewConfirm}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    color: C.ink3,
                    padding: 4,
                  }}
                >
                  ×
                </button>
                <div style={{ display: "flex", gap: 4, padding: "20px 18px 8px" }}>
                  <div style={{ flex: 1 }}>
                    <Eyebrow>{T.home.inProgressEyebrow}</Eyebrow>
                    <div style={{ fontFamily: F.display, fontSize: 26, lineHeight: 1.15, marginTop: 10 }}>
                      {T.roasts[inProgress.recipe.roast].label}
                      <br />
                      {inProgress.recipe.dose} g
                    </div>
                    <div style={{ fontFamily: F.mono, fontSize: 12.5, color: C.ink2, marginTop: 12, lineHeight: 1.7 }}>
                      {inProgress.recipe.water} g · 1:{inProgress.recipe.ratio}
                      <br />
                      {fmt(inProgress.elapsed)}
                    </div>
                  </div>
                  <div style={{ marginTop: -6, marginRight: -12 }}>
                    <BrewGauge methodKey={inProgress.recipe.method} recipe={inProgress.recipe} poured={inProgressPoured} />
                  </div>
                </div>
                <div style={{ padding: "10px 18px 18px" }}>
                  <Button onClick={resumeInProgress}>{T.home.continueBrew(activeMethod.label)}</Button>
                </div>
              </Card>
            )}
            {/* Skipped when there's an in-progress brew but nothing completed
                yet: "no brew yet" right below "brew in progress" reads as
                contradictory, and once there's a last brew this card is
                shown regardless. */}
            {(last || !inProgress) && (
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 4, padding: "20px 18px 8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <Eyebrow>
                        {last ? T.home.lastBrewEyebrow : T.home.noneEyebrow}
                        {last && ` · ${new Date(last.date).toLocaleDateString(T.locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                      </Eyebrow>
                      {last && (
                        <button
                          className="cbc-btn"
                          onClick={() => editFeedback(last)}
                          aria-label={T.home.editFeedback}
                          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.ink3, flexShrink: 0 }}
                        >
                          {T.home.editFeedback}
                        </button>
                      )}
                    </div>
                    {last ? (
                      <>
                        <div style={{ fontFamily: F.display, fontSize: 26, lineHeight: 1.15, marginTop: 10 }}>
                          {T.roasts[last.roast].label}
                          {last.feedback.taste ? (
                            <>
                              <br />
                              {T.home.becamePrefix} {T.taste[last.feedback.taste]}
                            </>
                          ) : null}
                        </div>
                        {last.feedback.pending && (
                          <div style={{ fontSize: 13, color: C.hot, marginTop: 6 }}>{T.home.tastePending}</div>
                        )}
                        <div style={{ fontFamily: F.mono, fontSize: 12.5, color: C.ink2, marginTop: 12, lineHeight: 1.7 }}>
                          {last.coffeeDose} g · {last.water} g · 1:{last.ratio}
                          <br />
                          {last.temperature} °C · {last.actualTime}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontFamily: F.display, fontSize: 25, lineHeight: 1.2, marginTop: 10 }}>{T.home.brewACup}</div>
                    )}
                  </div>
                  <div style={{ marginTop: -6, marginRight: -12 }}>
                    <BrewGauge
                      methodKey={last ? last.method || "chemex" : method}
                      recipe={
                        last
                          ? { water: last.water, bloom: last.coffeeDose * 2, pours: METHODS[last.method || "chemex"].pours(last.coffeeDose * 2, last.water) }
                          : { water: 480, bloom: 60, pours: activeMethod.pours(60, 480) }
                      }
                      poured={last ? last.water : 0}
                    />
                  </div>
                </div>
                <div style={{ padding: "10px 18px 18px" }}>
                  {last ? (
                    <>
                      <div style={{ fontSize: 14, lineHeight: 1.55, color: C.ink2, borderTop: `1px solid ${C.line}`, paddingTop: 14, marginBottom: 14 }}>
                        {T.home.lastSuggestion(
                          grindNote(last.method || "chemex", last.roast, last.suggestedNext.grindOffset, T).toLowerCase(),
                          last.suggestedNext.temperature,
                          last.suggestedNext.ratio
                        )}
                      </div>
                      <Button
                        onClick={() => {
                          if (last.feedback.pending) {
                            // Can't continue from a suggestion that hasn't
                            // actually been computed from a real taste
                            // answer yet — fill that in first.
                            editFeedback(last, true);
                            return;
                          }
                          openSetup(
                            {
                              roast: last.roast,
                              inputMode: "dose",
                              dose: last.coffeeDose,
                              ratio: last.suggestedNext.ratio,
                              temperature: last.suggestedNext.temperature,
                              grindOffset: last.suggestedNext.grindOffset,
                              roastDate: last.roastDate || null,
                              bestBefore: last.bestBefore || null,
                            },
                            last.method || "chemex"
                          );
                        }}
                      >
                        {T.home.continueFromLast}
                      </Button>
                      <div style={{ height: 8 }} />
                      <Button variant="quiet" onClick={() => startNewFromZero()}>
                        {T.home.newFromZero}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => openSetup({})}>{T.home.newBrew}</Button>
                  )}
                </div>
              </Card>
            )}
            {!loaded && <div style={{ fontSize: 13, color: C.ink3, marginTop: 12 }}>{T.home.loadingBrews}</div>}
          </div>
        )}

        {/* ---------------- Setup ---------------- */}
        {screen === "setup" && (
          <Card>
            <Eyebrow>{T.setup.step}</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 18px", fontWeight: 400 }}>{T.setup.heading}</h2>

            <div style={{ fontSize: 13, color: C.ink2, marginBottom: 8 }}>{T.setup.roastLevel}</div>
            {Object.values(activeMethod.ROASTS).map((r) => (
              <Choice
                key={r.key}
                label={T.roasts[r.key].label}
                sub={T.roasts[r.key].hint}
                selected={cfg.roast === r.key}
                onClick={() =>
                  setCfg((c) => ({ ...c, roast: r.key, temperature: clamp(c.temperature, r.tempMin, r.tempMax) === c.temperature ? clamp(c.temperature, r.tempMin, r.tempMax) : r.temp }))
                }
              />
            ))}

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>{T.setup.amount}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["dose", T.setup.gramsMode], ["cups", T.setup.cupsMode]].map(([k, l]) => (
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
                  suffix={T.setup.gCoffeeSuffix}
                  min={activeMethod.doseRange.min}
                  max={activeMethod.doseRange.max}
                  step={1}
                  bigStep={5}
                  onChange={(v) => setCfg((c) => ({ ...c, dose: v }))}
                  decreaseLabel={T.decrease}
                  increaseLabel={T.increase}
                />
                {cfg.dose > activeMethod.doseRange.warnAbove && (
                  <div style={{ fontSize: 12.5, color: C.hot, marginTop: 8, lineHeight: 1.45 }}>{T.methods[activeMethod.key].overDose}</div>
                )}
              </>
            ) : (
              <>
                <Stepper
                  value={cfg.cups}
                  suffix={cfg.cups === 1 ? T.setup.cupSingular : T.setup.cupPlural}
                  min={1}
                  max={10}
                  step={1}
                  onChange={(v) => setCfg((c) => ({ ...c, cups: v }))}
                  decreaseLabel={T.decrease}
                  increaseLabel={T.increase}
                />
                <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8 }}>{T.setup.yields(doseFromCups(cfg.cups, cfg.ratio))}</div>
              </>
            )}

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>{T.setup.ratio}</div>
            <Stepper
              value={cfg.ratio}
              prefix="1:"
              min={activeMethod.ratioRange.min}
              max={activeMethod.ratioRange.max}
              step={1}
              onChange={(v) => setCfg((c) => ({ ...c, ratio: v }))}
              decreaseLabel={T.decrease}
              increaseLabel={T.increase}
            />
            <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8 }}>{T.setup.ratioHint}</div>

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>
              {T.setup.roastDate} <span style={{ color: C.ink3 }}>{T.setup.optional}</span>
            </div>
            <input
              type="date"
              value={cfg.roastDate || ""}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCfg((c) => ({ ...c, roastDate: e.target.value || null }))}
              style={dateInput}
            />
            <div style={{ fontSize: 13, color: C.ink2, margin: "14px 0 8px" }}>
              {T.setup.bestBefore} <span style={{ color: C.ink3 }}>{T.setup.optional}</span>
            </div>
            <input
              type="date"
              value={cfg.bestBefore || ""}
              onChange={(e) => setCfg((c) => ({ ...c, bestBefore: e.target.value || null }))}
              style={dateInput}
            />

            {(() => {
              const p = ageProfile(cfg.roast, cfg, T);
              if (!p) return <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 10, lineHeight: 1.45 }}>{T.setup.noDataHint}</div>;
              return (
                <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ background: C.card, padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
                    <Eyebrow>
                      {T.setup.bestToBrew}
                      {p.estimated ? T.setup.estimatedSuffix : ""}
                    </Eyebrow>
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
                    {p.expired && T.setup.expiredSuffix}
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: 24 }}>
              <Button onClick={toRecipe}>{T.setup.showRecipe}</Button>
              <Button variant="plain" onClick={() => window.history.back()} style={{ marginTop: 6 }}>
                {T.setup.back}
              </Button>
            </div>
          </Card>
        )}

        {/* ---------------- Receptöversikt ---------------- */}
        {screen === "recipe" && recipe && (
          <Card>
            <Eyebrow>{T.recipe.step}</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 4px", fontWeight: 400 }}>
              {recipe.roastLabel}, {recipe.dose} g
            </h2>
            <div style={{ fontSize: 13.5, color: C.ink2, marginBottom: 16 }}>{T.recipe.weighEverything}</div>

            <Row label={T.recipe.coffee} value={`${recipe.dose} g`} />
            <Row label={T.recipe.water} value={`${recipe.water} g`} />
            <Row label={T.setup.ratio} value={`1:${recipe.ratio}`} />
            <Row label={T.recipe.temperature} value={`${recipe.temperature} °C`} accent={C.hot} />
            <Row label={T.recipe.grind} value={recipe.grindNote} />
            <Row
              label={T.recipe.bloom}
              value={`${recipe.bloom} g, ${recipe.bloomSec} s`}
              accent={recipe.rest && recipe.rest.bloomDelta !== 0 ? C.collar : undefined}
            />
            {recipe.rest && (
              <>
                <Row
                  label={recipe.rest.estimated ? T.recipe.ageEstimated : T.recipe.restAfterRoast}
                  value={`${recipe.rest.days} d — ${recipe.rest.label.toLowerCase()}`}
                  accent={recipe.rest.tone === "warn" ? C.hot : recipe.rest.tone === "ok" ? C.ok : C.ink}
                />
                <Row label={T.setup.bestToBrew} value={recipe.rest.sweet} accent={recipe.rest.key === "peak" ? C.ok : C.ink3} />
                <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 10 }}>
                  {recipe.rest.note} {recipe.rest.status}
                </div>
              </>
            )}
            <Row label={T.recipe.targetTime} value={`${fmt(recipe.targetLo)}–${fmt(recipe.targetHi)}`} />

            <div style={{ marginTop: 22 }}>
              <Button onClick={startBrew}>{T.recipe.startBrewing}</Button>
              <Button variant="plain" onClick={() => window.history.back()} style={{ marginTop: 6 }}>
                {T.recipe.changeSettings}
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
                  <BrewGauge methodKey={recipe.method} recipe={recipe} poured={poured} />
                </div>
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <Eyebrow>{T.brewScreen.clock}</Eyebrow>
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 42,
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.02em",
                      lineHeight: 1.1,
                      marginTop: 4,
                      color: clockColor,
                    }}
                  >
                    {fmt(elapsed)}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 12, color: C.ink3, marginTop: 2 }}>
                    {T.brewScreen.target} {fmt(recipe.targetLo)}–{fmt(recipe.targetHi)}
                  </div>
                  {nextStepAt !== undefined && (
                    <div style={{ fontFamily: F.mono, fontSize: 12, color: C.ink3, marginTop: 2 }}>
                      {T.brewScreen.nextAt}{" "}
                      <span style={{ fontSize: 14, fontWeight: 600, color: clockColor === C.ink ? C.ink : clockColor }}>
                        {fmt(nextStepAt)}
                      </span>
                    </div>
                  )}
                  {steps[stepIndex].id !== "rinse" && steps[stepIndex].id !== "grind" && (
                    <div style={{ marginTop: 14 }}>
                      <Button variant="quiet" onClick={() => setRunning((r) => !r)} style={{ padding: "9px 0", fontSize: 13.5 }}>
                        {running ? T.brewScreen.pause : elapsed === 0 ? T.brewScreen.start : T.brewScreen.continueLabel}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {!running && elapsed === 0 && (
              <Card style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 500 }}>{T.brewScreen.autoAdvance}</div>
                    <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 2 }}>{T.brewScreen.autoAdvanceHint}</div>
                  </div>
                  <Toggle checked={autoAdvance} onChange={() => setAutoAdvance((a) => !a)} />
                </div>
              </Card>
            )}

            <Card>
              <Eyebrow>{T.brewScreen.step(stepIndex + 1, steps.length)}</Eyebrow>
              <h2 style={{ fontFamily: F.display, fontSize: 24, margin: "8px 0 6px", fontWeight: 400 }}>{steps[stepIndex].title}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: C.ink2, margin: "0 0 14px" }}>{steps[stepIndex].detail}</p>

              {steps[stepIndex].target && (
                <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "12px 0", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13.5, color: C.ink2 }}>{T.brewScreen.pourTo}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 28, fontVariantNumeric: "tabular-nums" }}>{steps[stepIndex].target} g</span>
                </div>
              )}

              <Button onClick={nextStep} className={autoAdvancePending ? "cbc-pulse" : ""}>
                {autoAdvancePending
                  ? T.brewScreen.advancingSoon
                  : stepIndex === steps.length - 1
                  ? T.brewScreen.finished
                  : steps[stepIndex].id === "grind"
                  ? T.brewScreen.nextStepStartClock
                  : T.brewScreen.nextStep}
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
            <Eyebrow>{T.feedback.step}</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 4px", fontWeight: 400 }}>{T.feedback.heading}</h2>
            <div style={{ fontFamily: F.mono, fontSize: 12.5, color: C.ink2, marginBottom: 18 }}>
              {T.feedback.meta(recipe.dose, recipe.ratio, recipe.temperature, fmt(actual), fmt(recipe.target))}
            </div>

            <div style={{ fontSize: 13, color: C.ink2, marginBottom: 8 }}>{T.feedback.taste}</div>
            {Object.entries(T.taste).map(([k, l]) => (
              <Choice key={k} label={l[0].toUpperCase() + l.slice(1)} selected={fb.taste === k} onClick={() => setFb((f) => ({ ...f, taste: k }))} />
            ))}

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>{T.feedback.timeAndFlow}</div>
            {Object.entries(T.flow).map(([k, l]) => (
              <Choice
                key={k}
                label={k === "slow" ? T.feedback.wentSlow : k === "fast" ? T.feedback.wentFast : T.feedback.goodTime}
                sub={T.feedback.clockSays(l)}
                selected={fb.flow === k}
                onClick={() => setFb((f) => ({ ...f, flow: k }))}
              />
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "18px 0 8px" }}>
              <span style={{ fontSize: 13, color: C.ink2 }}>{T.feedback.grindAdjusted}</span>
              <Toggle checked={!!fb.grindAdjusted} onChange={() => setFb((f) => ({ ...f, grindAdjusted: !f.grindAdjusted }))} />
            </div>

            <div style={{ fontSize: 13, color: C.ink2, margin: "18px 0 8px" }}>{T.feedback.noteLabel}</div>
            <textarea
              value={fb.comment}
              onChange={(e) => setFb((f) => ({ ...f, comment: e.target.value }))}
              rows={3}
              placeholder={T.feedback.notePlaceholder}
              style={{ width: "100%", padding: 12, fontSize: 14, border: `1px solid ${C.line}`, borderRadius: 3, background: C.card, color: C.ink, resize: "vertical", boxSizing: "border-box" }}
            />

            <div style={{ marginTop: 20 }}>
              <Button onClick={() => saveFeedback(false)} disabled={!fb.taste || !fb.flow}>
                {T.feedback.save}
              </Button>
              {(!fb.taste || !fb.flow) && (
                <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8, textAlign: "center" }}>{T.feedback.pickBoth}</div>
              )}
              <Button variant="plain" onClick={() => saveFeedback(true)} style={{ marginTop: 6 }}>
                {T.feedback.answerLater}
              </Button>
            </div>
          </Card>
        )}

        {/* ---------------- Nästa rekommendation ---------------- */}
        {screen === "next" && result && (
          <Card>
            <Eyebrow>{T.next.eyebrow}</Eyebrow>
            <h2 style={{ fontFamily: F.display, fontSize: 23, margin: "10px 0 12px", fontWeight: 400, lineHeight: 1.3 }}>
              {result.s.grindStep === 0 && result.s.temperature === result.recipe.temperature && result.s.ratio === result.recipe.ratio
                ? T.next.changeNothing
                : T.next.howToAdjust}
            </h2>

            <div style={{ marginBottom: 16 }}>
              {result.s.why.map((w, i) => (
                <p key={i} style={{ fontSize: 14.5, lineHeight: 1.6, color: C.ink2, margin: "0 0 8px" }}>
                  {w}
                </p>
              ))}
            </div>

            {changeList(result.recipe, result.s, T).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} accent={r.changed ? C.collar : C.ink3} />
            ))}
            <Row label={T.next.newGrind} value={grindNote(result.recipe.method, result.recipe.roast, result.s.grindOffset, T)} />

            <div style={{ marginTop: 22 }}>
              <Button
                onClick={() =>
                  openSetup(
                    {
                      roast: result.recipe.roast,
                      inputMode: "dose",
                      dose: result.recipe.dose,
                      ratio: result.s.ratio,
                      temperature: result.s.temperature,
                      grindOffset: result.s.grindOffset,
                      roastDate: result.recipe.roastDate || null,
                      bestBefore: result.recipe.bestBefore || null,
                    },
                    result.recipe.method
                  )
                }
              >
                {T.next.useSuggestion}
              </Button>
              <div style={{ height: 8 }} />
              <Button variant="quiet" onClick={() => goTo("home")}>
                {T.next.done}
              </Button>
            </div>
          </Card>
        )}

        {/* ---------------- Historik ---------------- */}
        {screen === "history" && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Eyebrow>{T.history.eyebrow}</Eyebrow>
                  <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "10px 0 0", fontWeight: 400 }}>{T.history.count(methodBrews.length)}</h2>
                </div>
                <button
                  className="cbc-btn"
                  onClick={() =>
                    setConfirmAction({
                      message: T.confirm.clearAll(methodBrews.length),
                      confirmLabel: T.history.clearAll,
                      danger: true,
                      onConfirm: () => clearAllBrews(),
                    })
                  }
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.hot }}
                >
                  {T.history.clearAll}
                </button>
              </div>
            </Card>

            {methodBrews.map((b) => (
              <Card key={b.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{T.roasts[b.roast].label}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.ink3 }}>
                    {new Date(b.date).toLocaleDateString(T.locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 12.5, color: C.ink2, marginTop: 8, lineHeight: 1.7 }}>
                  {b.coffeeDose} g · {b.water} g · 1:{b.ratio} · {b.temperature} °C
                  <br />
                  {b.grindNote} · {T.history.timing(b.actualTime, b.targetTime)}
                  {b.restDays != null ? T.history.offRoastSuffix(b.restDays) : ""}
                </div>
                <div style={{ fontSize: 13.5, color: C.ink, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>
                  {b.feedback.taste ? (
                    <>
                      {T.history.became} {T.taste[b.feedback.taste]}, {T.flow[b.feedback.flow]}.
                      {b.feedback.comment ? ` ”${b.feedback.comment}”` : ""}
                    </>
                  ) : (
                    <span style={{ color: C.hot }}>{T.home.tastePending}</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, marginTop: 6 }}>
                  {T.history.next} {grindNote(b.method || "chemex", b.roast, b.suggestedNext.grindOffset, T).toLowerCase()}, {b.suggestedNext.temperature} °C, 1:{b.suggestedNext.ratio}.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginTop: 8 }}>
                  <button
                    className="cbc-btn"
                    onClick={() =>
                      setConfirmAction({
                        message: T.confirm.continueFromHistory,
                        confirmLabel: T.history.continueFromThis,
                        onConfirm: () =>
                          openSetup(
                            {
                              roast: b.roast,
                              inputMode: "dose",
                              dose: b.coffeeDose,
                              ratio: b.suggestedNext.ratio,
                              temperature: b.suggestedNext.temperature,
                              grindOffset: b.suggestedNext.grindOffset,
                              roastDate: b.roastDate || null,
                              bestBefore: b.bestBefore || null,
                            },
                            b.method || "chemex"
                          ),
                      })
                    }
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.ink3, flexShrink: 0 }}
                  >
                    {T.history.continueFromThis}
                  </button>
                  <button
                    className="cbc-btn"
                    onClick={() =>
                      setConfirmAction({
                        message: T.confirm.removeOne,
                        confirmLabel: T.history.remove,
                        danger: true,
                        onConfirm: () => removeBrew(b.id),
                      })
                    }
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.ink3, flexShrink: 0 }}
                  >
                    {T.history.remove}
                  </button>
                </div>
              </Card>
            ))}

            <Button variant="quiet" onClick={() => goTo("home")} style={{ marginTop: 6 }}>
              {T.history.toHome}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Sifferväljare med tumvänliga knappar */
function Stepper({ value, onChange, min, max, step, bigStep, prefix = "", suffix = "", decreaseLabel = "Decrease", increaseLabel = "Increase" }) {
  const btn = {
    width: 42,
    height: 46,
    borderRadius: 3,
    border: `1px solid ${C.line}`,
    background: "transparent",
    color: C.ink,
    fontSize: 17,
    cursor: "pointer",
    fontFamily: F.mono,
    lineHeight: 1,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {bigStep && (
        <button className="cbc-btn" style={btn} onClick={() => onChange(clamp(value - bigStep, min, max))} aria-label={`${decreaseLabel} ${bigStep}`}>
          −{bigStep}
        </button>
      )}
      <button className="cbc-btn" style={btn} onClick={() => onChange(clamp(value - step, min, max))} aria-label={decreaseLabel}>
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
          background: C.card,
        }}
      >
        {prefix}
        {value}
        {suffix ? ` ${suffix}` : ""}
      </div>
      <button className="cbc-btn" style={btn} onClick={() => onChange(clamp(value + step, min, max))} aria-label={increaseLabel}>
        +
      </button>
      {bigStep && (
        <button className="cbc-btn" style={btn} onClick={() => onChange(clamp(value + bigStep, min, max))} aria-label={`${increaseLabel} ${bigStep}`}>
          +{bigStep}
        </button>
      )}
    </div>
  );
}
