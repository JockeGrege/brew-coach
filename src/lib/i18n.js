import { useEffect, useState } from "react";

const sv = {
  locale: "sv-SE",
  appTitle: "Chemex Brew Coach",
  signOut: "Logga ut",
  historyNav: (n) => `Historik (${n})`,
  saveFailed: "Bryggningen kunde inte sparas. Skriv ner inställningarna innan du stänger sidan.",
  loggingIn: "Loggar in …",
  decrease: "Minska",
  increase: "Öka",

  auth: {
    prompt: "Logga in för att spara och synka dina bryggningar mellan enheter.",
    failed: (msg) => `Inloggningen misslyckades: ${msg}`,
    signIn: "Logga in med Google",
  },

  home: {
    lastBrewEyebrow: "Senaste bryggningen",
    noneEyebrow: "Ingen bryggning än",
    becamePrefix: "blev",
    brewACup: "Brygg en kopp. Nästa bygger på den.",
    lastSuggestion: (grind, temp, ratio) => `Förslaget från förra gången: ${grind}, ${temp} °C, 1:${ratio}.`,
    continueFromLast: "Fortsätt från förra",
    newFromZero: "Ny bryggning från noll",
    newBrew: "Ny bryggning",
    loadingBrews: "Läser in sparade bryggningar …",
  },

  setup: {
    step: "Steg 1 av 3 · Inställningar",
    heading: "Vad brygger du?",
    roastLevel: "Rostnivå",
    amount: "Mängd",
    gramsMode: "Gram kaffe",
    cupsMode: "Antal koppar",
    gCoffeeSuffix: "g kaffe",
    cupSingular: "kopp",
    cupPlural: "koppar",
    overDose: "Över 65 g blir kaffebädden djupare än 5 cm och extraktionen ojämn. Brygg hellre två omgångar.",
    yields: (g) => `Ger ${g} g kaffe. En kopp räknas som ca 170 ml färdigt kaffe.`,
    ratio: "Ratio",
    ratioHint: "Lägre siffra ger starkare kaffe. 1:16 är utgångsläget.",
    roastDate: "Rostdatum",
    optional: "— valfritt",
    bestBefore: "Bäst före",
    noDataHint:
      "Rostdatum står på de flesta påsar och är det säkra valet. Saknas det räknar appen baklänges från bäst före-datumet i stället. Med något av dem får du anpassad bloomtid och besked om när påsen är som bäst.",
    bestToBrew: "Bäst att brygga",
    estimatedSuffix: " (uppskattat)",
    expiredSuffix: " Bäst före-datumet har dessutom passerat.",
    showRecipe: "Visa receptet",
    back: "Tillbaka",
  },

  recipe: {
    step: "Steg 2 av 3 · Recept",
    weighEverything: "Väg upp allt innan du börjar. Klockan startar när bloomen gör det.",
    coffee: "Kaffe",
    water: "Vatten",
    temperature: "Temperatur",
    grind: "Malning",
    bloom: "Bloom",
    ageEstimated: "Ålder (uppskattad)",
    restAfterRoast: "Vila efter rost",
    targetTime: "Måltid",
    startBrewing: "Starta bryggningen",
    changeSettings: "Ändra inställningar",
  },

  brewScreen: {
    clock: "Klocka",
    target: "mål",
    pause: "Pausa klockan",
    start: "Starta klockan",
    continueLabel: "Fortsätt",
    step: (i, n) => `Steg ${i} av ${n}`,
    pourTo: "Häll till",
    nextStep: "Klart – nästa steg",
    finished: "Bryggningen är klar",
  },

  feedback: {
    step: "Steg 3 av 3 · Efter bryggningen",
    heading: "Hur blev den?",
    meta: (dose, ratio, temp, actual, target) => `${dose} g · 1:${ratio} · ${temp} °C · ${actual} mot mål ${target}`,
    taste: "Smak",
    timeAndFlow: "Tid och flöde",
    wentSlow: "Gick långsamt",
    wentFast: "Gick snabbt",
    goodTime: "Bra tid",
    clockSays: (l) => `Klockan säger ${l}`,
    noteLabel: "Anteckning, om du vill",
    notePlaceholder: "Nytt kaffe, kallt kök, hällde slarvigt …",
    save: "Spara och få nästa förslag",
    pickBoth: "Välj både smak och tid för att gå vidare.",
  },

  next: {
    eyebrow: "Nästa bryggning",
    changeNothing: "Ändra ingenting.",
    howToAdjust: "Så här justerar du.",
    newGrind: "Ny malning",
    useSuggestion: "Använd förslaget",
    done: "Klart för idag",
    unchanged: "Oförändrad",
    grindStep: (dir) => `1 steg ${dir}`,
    coarser: "grövre",
    finer: "finare",
    tempUnchanged: (t) => `${t} °C, oförändrad`,
    ratioUnchanged: (r) => `1:${r}, oförändrad`,
  },

  history: {
    eyebrow: "Historik",
    count: (n) => `${n} ${n === 1 ? "bryggning" : "bryggningar"}`,
    timing: (actual, target) => `${actual} mot mål ${target}`,
    became: "Blev",
    offRoastSuffix: (n) => ` · ${n} d efter rost`,
    next: "Nästa:",
    toHome: "Till startsidan",
  },

  roasts: {
    light: { label: "Ljusrost", grind: "Medium-grov", hint: "Blommigt och syrligt. Tål högst temperatur och längst tid." },
    medium: { label: "Mellanrost", grind: "Medium-grov", hint: "Balanserat. Mittfåran i både temperatur och tid." },
    dark: { label: "Mörkrost", grind: "Lite grövre", hint: "Choklad och rostade toner. Blir lätt besk — kortare tid, lägre värme." },
  },

  taste: {
    sour: "för surt",
    bitter: "för beskt eller torrt",
    weak: "för svagt",
    strong: "för starkt",
    balanced: "bra balanserat",
  },

  flow: {
    slow: "långsammare än målet",
    fast: "snabbare än målet",
    ok: "inom måltiden",
  },

  grindNote: (base, steps, dir) => `${base}, ${steps} steg ${dir}`,

  steps: {
    rinse: {
      title: "Skölj filtret",
      detail: "Vik filtret så att tre lager ligger mot pipen. Skölj igenom med hett vatten och häll ur sköljvattnet.",
    },
    grind: {
      title: "Mal och nolla vågen",
      detail: (dose, grindNote, temp) => `Mal ${dose} g på ${grindNote}. Jämna till bädden och nolla vågen. Vattnet ska hålla ${temp} °C.`,
    },
    bloom: {
      title: "Bloom",
      detail: (bloom, sec) => `Häll till ${bloom} g så att allt kaffe blir blött. Rör om lätt och låt stå ${sec} sekunder.`,
    },
    p1: { title: "Hällning 1", detail: (g) => `Häll i spiral upp till ${g} g.` },
    p2: { title: "Hällning 2", detail: (g) => `Fyll på till ${g} g när nivån sjunkit.` },
    p3: { title: "Hällning 3", detail: (g) => `Sista hällningen, upp till ${g} g.` },
    drawdown: {
      title: "Låt rinna klart",
      detail: (lo, hi) => `Måltid ${lo}–${hi}. Stoppa klockan när bädden är torrlagd och lyft filtret.`,
    },
  },

  suggest: {
    sourGrindCoarserTempWarmer: "Surt betyder underextraherat, men tiden drog över — därför grövre malning och en grad varmare vatten i stället.",
    sourGrindCoarserTempMaxed: (temp, roastLabel) =>
      `Surt betyder underextraherat. Malningen får ändå gå grövre eftersom tiden drog över, och ${temp} °C är redan max för ${roastLabel}.`,
    sourAlreadyFiner: "Finare malning fixar både den snabba tiden och surheten.",
    sourToFiner: "Surt betyder underextraherat. Finare malning ger mer utbyte.",
    bitterGrindFinerTempCooler: "Beskt betyder överextraherat, men tiden var för kort — därför finare malning och svalare vatten.",
    bitterGrindFinerTempMinned: (temp, roastLabel) =>
      `Beskt betyder överextraherat, men tiden var för kort. ${temp} °C är redan lägst för ${roastLabel}.`,
    bitterAlreadyCoarser: "Grövre malning kortar både tiden och beskan.",
    bitterToCoarser: "Beskt betyder överextraherat. Grövre malning drar ur mindre.",
    weak: (ratio) => `Tunt kaffe är en fråga om styrka, inte extraktion. Starkare ratio 1:${ratio} ger mer kaffe per liter.`,
    strong: (ratio) => `Svagare ratio 1:${ratio} tar ner styrkan utan att röra smakbilden.`,
    balancedSame: "Smaken satt och tiden höll. Kör exakt samma inställningar igen.",
    balancedTimeOnly: "Smaken satt, så bara tiden justeras.",
    freshSourOkA: (days) =>
      `Tiden höll, men kaffet är bara ${days} dagar från rost. Så här tidigt kommer surheten oftast från koldioxid som stöter bort vattnet under bloomen — delar av bädden hinner aldrig extraheras.`,
    freshSourOkB: "Rör ingenting. Brygg samma recept om två–tre dagar och jämför: skiljer sig koppen åt var det kaffet, inte kvarnen.",
    freshSourOther: (days) =>
      `Med ${days} dagar från rost kan en del av surheten vara CO₂ snarare än underextraktion. Justeringen ovan gäller tiden — vänta med att jaga smaken tills kaffet vilat ut.`,
    fadingOldWeakOrSour: (days) =>
      `Kaffet är ${days} dagar gammalt. Tunnhet och platta toner så här sent är bortvittrad aromatik, och receptet kan dölja det men inte lösa det.`,
  },

  rest: {
    label: {
      fresh: "För färskt",
      gassy: "Fortfarande gasigt",
      peak: "I fönstret",
      fading: "På väg ut",
      old: "Förbi sin tid",
    },
    note: {
      fresh: (age) =>
        `${age}. Bädden sväller kraftigt och stöter bort vattnet, så extraktionen blir ojämn och koppen smakar vassare än kaffet är. Bloomen förlängs för att kompensera.`,
      gassy: (age) => `${age}. Fullt drickbart, men det finns CO₂ kvar. Bloomen förlängs så att gasen hinner ut innan huvudhällningarna.`,
      peak: (age) =>
        `${age}, mitt i det bästa fönstret. Standardbloom. Det är nu kvarninställningen är värd att finkalibrera — vad som händer i koppen beror på dig och inte på kaffets ålder.`,
      fading: (age) => `${age}. Mindre CO₂ kvar ger en svagare bloom, så den kortas. Tappar koppen blommighet nu är det åldern som talar, inte receptet.`,
      old: (age) =>
        `${age}. Aromatiken har till stor del vittrat bort. Kortare bloom, men räkna inte med att någon justering väger upp det — spara hellre feedbacken till nästa påse.`,
    },
    estimatedSuffix: (months) =>
      ` Åldern är uppskattad från bäst före-datumet med ${months} månaders hållbarhet, så räkna med några veckors osäkerhet — justeringen är dämpad därefter.`,
    status: {
      upcoming: (d) => `Som bäst om ${d}.`,
      now: (d) => `Som bäst nu — ${d} kvar av fönstret.`,
      past: (d) => `Fönstret tog slut för ${d} sedan.`,
    },
    age: (d) => `${d} efter rost`,
    day: (n) => `${n} ${Math.abs(n) === 1 ? "dag" : "dagar"}`,
  },

  theme: { light: "Ljust", dark: "Mörkt" },
  lang: { sv: "Svenska", en: "English" },
};

const en = {
  locale: "en-US",
  appTitle: "Chemex Brew Coach",
  signOut: "Sign out",
  historyNav: (n) => `History (${n})`,
  saveFailed: "The brew couldn't be saved. Write down the settings before closing the page.",
  loggingIn: "Signing in …",
  decrease: "Decrease",
  increase: "Increase",

  auth: {
    prompt: "Sign in to save and sync your brews across devices.",
    failed: (msg) => `Sign-in failed: ${msg}`,
    signIn: "Sign in with Google",
  },

  home: {
    lastBrewEyebrow: "Last brew",
    noneEyebrow: "No brews yet",
    becamePrefix: "came out",
    brewACup: "Brew a cup. The next one builds on it.",
    lastSuggestion: (grind, temp, ratio) => `Suggestion from last time: ${grind}, ${temp} °C, 1:${ratio}.`,
    continueFromLast: "Continue from last time",
    newFromZero: "New brew from scratch",
    newBrew: "New brew",
    loadingBrews: "Loading saved brews …",
  },

  setup: {
    step: "Step 1 of 3 · Settings",
    heading: "What are you brewing?",
    roastLevel: "Roast level",
    amount: "Amount",
    gramsMode: "Grams of coffee",
    cupsMode: "Number of cups",
    gCoffeeSuffix: "g coffee",
    cupSingular: "cup",
    cupPlural: "cups",
    overDose: "Above 65 g the coffee bed gets deeper than 5 cm and extraction turns uneven. Better to brew two batches instead.",
    yields: (g) => `Yields ${g} g of coffee. A cup counts as roughly 170 ml of brewed coffee.`,
    ratio: "Ratio",
    ratioHint: "A lower number gives stronger coffee. 1:16 is the default.",
    roastDate: "Roast date",
    optional: "— optional",
    bestBefore: "Best before",
    noDataHint:
      "The roast date is on most bags and is the reliable choice. If it's missing, the app works backward from the best-before date instead. With either one you get a tailored bloom time and a heads-up on when the bag is at its best.",
    bestToBrew: "Best to brew",
    estimatedSuffix: " (estimated)",
    expiredSuffix: " The best-before date has also passed.",
    showRecipe: "Show the recipe",
    back: "Back",
  },

  recipe: {
    step: "Step 2 of 3 · Recipe",
    weighEverything: "Weigh everything out before you start. The clock starts when the bloom does.",
    coffee: "Coffee",
    water: "Water",
    temperature: "Temperature",
    grind: "Grind",
    bloom: "Bloom",
    ageEstimated: "Age (estimated)",
    restAfterRoast: "Rest after roast",
    targetTime: "Target time",
    startBrewing: "Start brewing",
    changeSettings: "Change settings",
  },

  brewScreen: {
    clock: "Clock",
    target: "target",
    pause: "Pause clock",
    start: "Start clock",
    continueLabel: "Continue",
    step: (i, n) => `Step ${i} of ${n}`,
    pourTo: "Pour to",
    nextStep: "Done – next step",
    finished: "Brewing is done",
  },

  feedback: {
    step: "Step 3 of 3 · After brewing",
    heading: "How did it turn out?",
    meta: (dose, ratio, temp, actual, target) => `${dose} g · 1:${ratio} · ${temp} °C · ${actual} vs target ${target}`,
    taste: "Taste",
    timeAndFlow: "Time and flow",
    wentSlow: "Ran slow",
    wentFast: "Ran fast",
    goodTime: "Good time",
    clockSays: (l) => `Clock says ${l}`,
    noteLabel: "Note, if you like",
    notePlaceholder: "New coffee, cold kitchen, sloppy pour …",
    save: "Save and get the next suggestion",
    pickBoth: "Pick both taste and time to continue.",
  },

  next: {
    eyebrow: "Next brew",
    changeNothing: "Change nothing.",
    howToAdjust: "Here's how to adjust.",
    newGrind: "New grind",
    useSuggestion: "Use the suggestion",
    done: "Done for today",
    unchanged: "Unchanged",
    grindStep: (dir) => `1 step ${dir}`,
    coarser: "coarser",
    finer: "finer",
    tempUnchanged: (t) => `${t} °C, unchanged`,
    ratioUnchanged: (r) => `1:${r}, unchanged`,
  },

  history: {
    eyebrow: "History",
    count: (n) => `${n} ${n === 1 ? "brew" : "brews"}`,
    timing: (actual, target) => `${actual} vs target ${target}`,
    became: "Came out",
    offRoastSuffix: (n) => ` · ${n} d off roast`,
    next: "Next:",
    toHome: "Back to home",
  },

  roasts: {
    light: { label: "Light roast", grind: "Medium-coarse", hint: "Floral and bright. Tolerates the highest temperature and longest time." },
    medium: { label: "Medium roast", grind: "Medium-coarse", hint: "Balanced. The middle ground on both temperature and time." },
    dark: { label: "Dark roast", grind: "Slightly coarser", hint: "Chocolate and roasted notes. Turns bitter easily — shorter time, lower heat." },
  },

  taste: {
    sour: "too sour",
    bitter: "too bitter or dry",
    weak: "too weak",
    strong: "too strong",
    balanced: "well balanced",
  },

  flow: {
    slow: "slower than target",
    fast: "faster than target",
    ok: "within target",
  },

  grindNote: (base, steps, dir) => `${base}, ${steps} step${steps > 1 ? "s" : ""} ${dir}`,

  steps: {
    rinse: {
      title: "Rinse the filter",
      detail: "Fold the filter so three layers sit against the spout. Rinse through with hot water and pour out the rinse water.",
    },
    grind: {
      title: "Grind and zero the scale",
      detail: (dose, grindNote, temp) => `Grind ${dose} g at ${grindNote}. Level the bed and zero the scale. The water should be ${temp} °C.`,
    },
    bloom: {
      title: "Bloom",
      detail: (bloom, sec) => `Pour to ${bloom} g so all the coffee gets wet. Stir gently and let it sit for ${sec} seconds.`,
    },
    p1: { title: "Pour 1", detail: (g) => `Pour in a spiral up to ${g} g.` },
    p2: { title: "Pour 2", detail: (g) => `Top up to ${g} g once the level has dropped.` },
    p3: { title: "Pour 3", detail: (g) => `Final pour, up to ${g} g.` },
    drawdown: {
      title: "Let it drain",
      detail: (lo, hi) => `Target time ${lo}–${hi}. Stop the clock once the bed is dry and lift the filter.`,
    },
  },

  suggest: {
    sourGrindCoarserTempWarmer: "Sour means underextracted, but the time ran long — so coarser grind and one degree warmer water instead.",
    sourGrindCoarserTempMaxed: (temp, roastLabel) =>
      `Sour means underextracted. The grind still goes coarser since the time ran long, and ${temp} °C is already the max for ${roastLabel}.`,
    sourAlreadyFiner: "Finer grind fixes both the fast time and the sourness.",
    sourToFiner: "Sour means underextracted. Finer grind gives more extraction.",
    bitterGrindFinerTempCooler: "Bitter means overextracted, but the time was too short — so finer grind and cooler water.",
    bitterGrindFinerTempMinned: (temp, roastLabel) =>
      `Bitter means overextracted, but the time was too short. ${temp} °C is already the lowest for ${roastLabel}.`,
    bitterAlreadyCoarser: "Coarser grind shortens both the time and the bitterness.",
    bitterToCoarser: "Bitter means overextracted. Coarser grind pulls out less.",
    weak: (ratio) => `Thin coffee is a strength issue, not extraction. Stronger ratio 1:${ratio} gives more coffee per liter.`,
    strong: (ratio) => `Weaker ratio 1:${ratio} brings the strength down without touching the flavor balance.`,
    balancedSame: "The taste was right and the time held. Run the exact same settings again.",
    balancedTimeOnly: "The taste was right, so only the time gets adjusted.",
    freshSourOkA: (days) =>
      `The time held, but the coffee is only ${days} days off roast. This early, sourness usually comes from CO₂ pushing water away during the bloom — parts of the bed never get extracted.`,
    freshSourOkB: "Don't change anything. Brew the same recipe again in two to three days and compare: if the cup differs, it was the coffee, not the grinder.",
    freshSourOther: (days) =>
      `With ${days} days off roast, some of the sourness could be CO₂ rather than underextraction. The adjustment above is for the timing — hold off chasing the taste until the coffee has rested more.`,
    fadingOldWeakOrSour: (days) =>
      `The coffee is ${days} days old. Thinness and flat notes this late are faded aromatics, and the recipe can mask that but not fix it.`,
  },

  rest: {
    label: {
      fresh: "Too fresh",
      gassy: "Still gassy",
      peak: "In the window",
      fading: "Fading out",
      old: "Past its prime",
    },
    note: {
      fresh: (age) =>
        `${age}. The bed swells hard and pushes the water away, so extraction turns uneven and the cup tastes sharper than the coffee really is. The bloom is extended to compensate.`,
      gassy: (age) => `${age}. Fully drinkable, but there's still CO₂ left. The bloom is extended so the gas has time to escape before the main pours.`,
      peak: (age) =>
        `${age}, right in the best window. Standard bloom. This is when it's worth fine-tuning the grind — what happens in the cup comes down to you now, not the coffee's age.`,
      fading: (age) => `${age}. Less CO₂ left means a weaker bloom, so it's shortened. If the cup loses its floral notes now, that's the age talking, not the recipe.`,
      old: (age) =>
        `${age}. Most of the aromatics have faded away by now. Shorter bloom, but don't expect any adjustment to make up for it — save the feedback for the next bag instead.`,
    },
    estimatedSuffix: (months) =>
      ` The age is estimated from the best-before date assuming ${months} months of shelf life, so expect a few weeks of uncertainty — the adjustment is dampened accordingly.`,
    status: {
      upcoming: (d) => `Best in ${d}.`,
      now: (d) => `Best right now — ${d} left in the window.`,
      past: (d) => `The window closed ${d} ago.`,
    },
    age: (d) => `${d} off roast`,
    day: (n) => `${n} ${Math.abs(n) === 1 ? "day" : "days"}`,
  },

  theme: { light: "Light", dark: "Dark" },
  lang: { sv: "Svenska", en: "English" },
};

export const translations = { sv, en };

const LANG_KEY = "chemex:lang";

function loadLang() {
  try {
    return window.localStorage.getItem(LANG_KEY) === "en" ? "en" : "sv";
  } catch {
    return "sv";
  }
}

export function useLang() {
  const [lang, setLang] = useState(loadLang);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  return [lang, setLang];
}
