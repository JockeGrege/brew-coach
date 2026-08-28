import { useEffect, useState } from "react";

const sv = {
  locale: "sv-SE",
  brandSuffix: "Brew Coach",
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
    continueAsGuest: "Fortsätt utan konto",
    guestCaption: "Du kan skapa ett konto senare utan att förlora något.",
    guestHint: "Du brygger som gäst. Skapa ett konto för att spara din historik permanent.",
    guestCleanupWarning: (n) => `Ditt gästkonto raderas om ${n} ${n === 1 ? "dag" : "dagar"} om du inte skapar ett konto.`,
    createAccount: "Skapa konto",
    linkFailed: (msg) => `Det gick inte att skapa kontot: ${msg}`,
    credentialInUse: "Det här Google-kontot har redan en profil. Logga ut och logga in normalt istället.",
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
    inProgressEyebrow: "Pågående bryggning",
    continueBrew: (methodLabel) => `Fortsätt ${methodLabel}-bryggningen`,
    editFeedback: "Ändra svar",
    tastePending: "Smakbedömning väntar",
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
    grindChangeNeeded: (steps, dir) => `Malningen ska ställas ${steps} steg ${dir} jämfört med förra bryggningen.`,
    grindChangeConfirm: "Jag har ställt in kvarnen",
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
    nextStepStartClock: "Klart – starta klockan",
    finished: "Bryggningen är klar",
    nextAt: "Nästa steg",
    autoAdvance: "Gå vidare automatiskt",
    autoAdvanceHint: "Nästa steg startar av sig själv när tiden är inne.",
    advancingSoon: "Går vidare …",
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
    answerLater: "Svara senare",
  },

  next: {
    eyebrow: "Nästa bryggning",
    changeNothing: "Ändra ingenting.",
    howToAdjust: "Så här justerar du.",
    useSuggestion: "Använd förslaget",
    done: "Klart för idag",
    unchanged: "Oförändrad",
    grindStep: (n, dir) => `${n} steg ${dir}`,
    coarser: "grövre",
    finer: "finare",
    tempUnchanged: (t) => `${t} °C, oförändrad`,
    ratioUnchanged: (r) => `1:${r}, oförändrad`,
    grinderConfirmNow: "Jag har nu ställt in kvarnen",
  },

  history: {
    eyebrow: "Historik",
    count: (n) => `${n} ${n === 1 ? "bryggning" : "bryggningar"}`,
    timing: (actual, target) => `${actual} mot mål ${target}`,
    became: "Blev",
    offRoastSuffix: (n) => ` · ${n} d efter rost`,
    next: "Nästa:",
    toHome: "Till startsidan",
    clearAll: "Radera allt",
    remove: "Ta bort",
    continueFromThis: "Fortsätt härifrån",
  },

  confirm: {
    cancel: "Avbryt",
    signOut: "Är du säker på att du vill logga ut?",
    signOutGuest: "Är du säker på att du vill logga ut? Som gäst kan du inte logga in igen på det här kontot senare — historiken försvinner.",
    clearAll: (n) => `Radera alla ${n} bryggningar? Det går inte att ångra.`,
    removeOne: "Ta bort den här bryggningen? Det går inte att ångra.",
    abortBrew: "Vill du avbryta den pågående bryggningen? Framstegen sparas inte.",
    abortBrewConfirm: "Avbryt bryggningen",
    startNewWhileInProgress: "Du har en pågående bryggning. Är du säker på att du vill starta en ny bryggning?",
    continueFromHistory: "Vill du fortsätta från den här bryggningen?",
  },

  roasts: {
    light: { label: "Ljusrost", hint: "Blommigt och syrligt. Tål högst temperatur och längst tid." },
    medium: { label: "Mellanrost", hint: "Balanserat. Mittfåran i både temperatur och tid." },
    dark: { label: "Mörkrost", hint: "Choklad och rostade toner. Blir lätt besk — kortare tid, lägre värme." },
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

  grindNote: (base, steps, dir) => `${base}, ${steps} steg ${dir} än grundinställningen`,

  steps: {
    grind: {
      title: "Mal och nolla vågen",
      detail: (dose, grindNote, temp) => `Mal ${dose} g på ${grindNote}. Jämna till bädden och nolla vågen. Vattnet ska hålla ${temp} °C.`,
    },
    bloom: {
      title: "Bloom",
      detail: (bloom, sec) => `Häll till ${bloom} g så att allt kaffe blir blött. Rör om lätt och låt stå ${sec} sekunder.`,
    },
    pour: (n, total) => ({
      title: `Hällning ${n}`,
      detail: (g) =>
        n === 1
          ? `Häll i spiral upp till ${g} g.`
          : n === total
          ? `Sista hällningen, upp till ${g} g.`
          : `Fyll på till ${g} g när nivån sjunkit.`,
    }),
  },

  methods: {
    chemex: {
      roastGrind: { light: "Medium-grov", medium: "Medium-grov", dark: "Lite grövre" },
      overDose: "Över 65 g blir kaffebädden djupare än 5 cm och extraktionen ojämn. Brygg hellre två omgångar.",
      steps: {
        rinse: {
          title: "Skölj filtret",
          detail: "Vik filtret så att tre lager ligger mot pipen. Skölj igenom med hett vatten och häll ur sköljvattnet.",
        },
        drawdown: {
          title: "Låt rinna klart",
          detail: (lo, hi) => `Måltid ${lo}–${hi}. Stoppa klockan när bädden är torrlagd och lyft filtret.`,
        },
      },
    },
    v60: {
      roastGrind: { light: "Medium-fin", medium: "Medium-fin", dark: "Lite grövre" },
      overDose: "Över 35 g blir bädden för djup för tratten och extraktionen ojämn. Brygg hellre två omgångar.",
      steps: {
        rinse: {
          title: "Skölj filtret",
          detail: "Vik ut filtret i tratten och skölj igenom med hett vatten för att värma bryggaren och ta bort pappenssmak. Häll ur sköljvattnet.",
        },
        drawdown: {
          title: "Låt rinna klart",
          detail: (lo, hi) => `Måltid ${lo}–${hi}. Stoppa klockan när bädden är torrlagd och lyft bryggaren.`,
        },
      },
    },
    kalita: {
      roastGrind: { light: "Medium", medium: "Medium", dark: "Lite grövre" },
      overDose: "Över 35 g blir bädden för djup för filtret och extraktionen ojämn. Brygg hellre två omgångar.",
      steps: {
        rinse: {
          title: "Skölj filtret",
          detail: "Placera det vågiga filtret plant i bryggaren och skölj igenom med hett vatten för att värma bryggaren och ta bort pappenssmak. Häll ur sköljvattnet.",
        },
        drawdown: {
          title: "Låt rinna klart",
          detail: (lo, hi) => `Måltid ${lo}–${hi}. Stoppa klockan när bädden är torrlagd och lyft bryggaren.`,
        },
      },
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
    grindMechanism: (actual, lo, hi, coarser) =>
      coarser
        ? `Bryggningen tog ${actual} mot målfönstret ${lo}–${hi}. Grövre malning ökar flödet genom bädden och kortar tiden till nästa gång.`
        : `Bryggningen tog ${actual} mot målfönstret ${lo}–${hi}. Finare malning bromsar flödet genom bädden och förlänger tiden till nästa gång.`,
    tempMechanism: (temp, warmer) =>
      warmer
        ? `Varmare vatten löser ut smakämnena snabbare, vilket höjer extraktionen — ${temp} °C nu.`
        : `Kallare vatten löser ut smakämnena långsammare, vilket sänker extraktionen — ${temp} °C nu.`,
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
  chooseMethod: "Bryggmetod",
  sources: {
    title: "Källor",
    intro: (methodLabel) => `Siffrorna för ${methodLabel} — ratio, malning, temperatur, bloom och tider — är hämtade från de här brygg guiderna.`,
    close: "Stäng",
  },
};

const en = {
  locale: "en-US",
  brandSuffix: "Brew Coach",
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
    continueAsGuest: "Continue without an account",
    guestCaption: "You can create an account later without losing anything.",
    guestHint: "You're brewing as a guest. Create an account to save your history permanently.",
    guestCleanupWarning: (n) => `Your guest account will be deleted in ${n} ${n === 1 ? "day" : "days"} unless you create an account.`,
    createAccount: "Create account",
    linkFailed: (msg) => `Couldn't create the account: ${msg}`,
    credentialInUse: "This Google account already has a profile. Sign out and sign in normally instead.",
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
    inProgressEyebrow: "Brew in progress",
    continueBrew: (methodLabel) => `Continue ${methodLabel} Brew`,
    editFeedback: "Edit answer",
    tastePending: "Taste review pending",
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
    grindChangeNeeded: (steps, dir) => `The grind needs to be set ${steps} step${steps === 1 ? "" : "s"} ${dir} compared to your last brew.`,
    grindChangeConfirm: "I've set the grinder",
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
    nextStepStartClock: "Done – start clock",
    finished: "Brewing is done",
    nextAt: "Next step",
    autoAdvance: "Auto-advance",
    autoAdvanceHint: "The next step will start on its own when it's time.",
    advancingSoon: "Advancing …",
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
    answerLater: "Answer later",
  },

  next: {
    eyebrow: "Next brew",
    changeNothing: "Change nothing.",
    howToAdjust: "Here's how to adjust.",
    useSuggestion: "Use the suggestion",
    done: "Done for today",
    unchanged: "Unchanged",
    grindStep: (n, dir) => `${n} step${n === 1 ? "" : "s"} ${dir}`,
    coarser: "coarser",
    finer: "finer",
    tempUnchanged: (t) => `${t} °C, unchanged`,
    ratioUnchanged: (r) => `1:${r}, unchanged`,
    grinderConfirmNow: "I've now set the grinder",
  },

  history: {
    eyebrow: "History",
    count: (n) => `${n} ${n === 1 ? "brew" : "brews"}`,
    timing: (actual, target) => `${actual} vs target ${target}`,
    became: "Came out",
    offRoastSuffix: (n) => ` · ${n} d off roast`,
    next: "Next:",
    toHome: "Back to home",
    clearAll: "Delete all",
    remove: "Remove",
    continueFromThis: "Continue from this",
  },

  confirm: {
    cancel: "Cancel",
    signOut: "Are you sure you want to sign out?",
    signOutGuest: "Are you sure you want to sign out? As a guest, you won't be able to sign back into this account later — your history will be gone.",
    clearAll: (n) => `Delete all ${n} brews? This can't be undone.`,
    removeOne: "Remove this brew? This can't be undone.",
    abortBrew: "Abort the brew in progress? Your progress won't be saved.",
    abortBrewConfirm: "Abort brewing",
    startNewWhileInProgress: "You currently have a brew going. Are you sure you want to start a new brew?",
    continueFromHistory: "Do you want to continue from this brew?",
  },

  roasts: {
    light: { label: "Light roast", hint: "Floral and bright. Tolerates the highest temperature and longest time." },
    medium: { label: "Medium roast", hint: "Balanced. The middle ground on both temperature and time." },
    dark: { label: "Dark roast", hint: "Chocolate and roasted notes. Turns bitter easily — shorter time, lower heat." },
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

  grindNote: (base, steps, dir) => `${base}, ${steps} step${steps > 1 ? "s" : ""} ${dir} than the baseline`,

  steps: {
    grind: {
      title: "Grind and zero the scale",
      detail: (dose, grindNote, temp) => `Grind ${dose} g at ${grindNote}. Level the bed and zero the scale. The water should be ${temp} °C.`,
    },
    bloom: {
      title: "Bloom",
      detail: (bloom, sec) => `Pour to ${bloom} g so all the coffee gets wet. Stir gently and let it sit for ${sec} seconds.`,
    },
    pour: (n, total) => ({
      title: `Pour ${n}`,
      detail: (g) =>
        n === 1
          ? `Pour in a spiral up to ${g} g.`
          : n === total
          ? `Final pour, up to ${g} g.`
          : `Top up to ${g} g once the level has dropped.`,
    }),
  },

  methods: {
    chemex: {
      roastGrind: { light: "Medium-coarse", medium: "Medium-coarse", dark: "Slightly coarser" },
      overDose: "Above 65 g the coffee bed gets deeper than 5 cm and extraction turns uneven. Better to brew two batches instead.",
      steps: {
        rinse: {
          title: "Rinse the filter",
          detail: "Fold the filter so three layers sit against the spout. Rinse through with hot water and pour out the rinse water.",
        },
        drawdown: {
          title: "Let it drain",
          detail: (lo, hi) => `Target time ${lo}–${hi}. Stop the clock once the bed is dry and lift the filter.`,
        },
      },
    },
    v60: {
      roastGrind: { light: "Medium-fine", medium: "Medium-fine", dark: "Slightly coarser" },
      overDose: "Above 35 g the bed gets too deep for the cone and extraction turns uneven. Better to brew two batches instead.",
      steps: {
        rinse: {
          title: "Rinse the filter",
          detail: "Unfold the filter into the cone and rinse through with hot water to warm the dripper and remove any paper taste. Pour out the rinse water.",
        },
        drawdown: {
          title: "Let it drain",
          detail: (lo, hi) => `Target time ${lo}–${hi}. Stop the clock once the bed is dry and lift the dripper.`,
        },
      },
    },
    kalita: {
      roastGrind: { light: "Medium", medium: "Medium", dark: "Slightly coarser" },
      overDose: "Above 35 g the bed gets too deep for the filter and extraction turns uneven. Better to brew two batches instead.",
      steps: {
        rinse: {
          title: "Rinse the filter",
          detail: "Place the wave filter flat in the dripper and rinse with hot water to warm the brewer and remove the papery taste. Pour out the rinse water.",
        },
        drawdown: {
          title: "Let it drain",
          detail: (lo, hi) => `Target time ${lo}–${hi}. Stop the clock once the bed has drained and lift the brewer.`,
        },
      },
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
    grindMechanism: (actual, lo, hi, coarser) =>
      coarser
        ? `The brew took ${actual} against a ${lo}–${hi} target. Coarser grind speeds up the flow through the bed and shortens the time next round.`
        : `The brew took ${actual} against a ${lo}–${hi} target. Finer grind slows the flow through the bed and extends the time next round.`,
    tempMechanism: (temp, warmer) =>
      warmer
        ? `Warmer water dissolves the flavor compounds faster, which raises extraction — ${temp} °C now.`
        : `Cooler water dissolves the flavor compounds slower, which lowers extraction — ${temp} °C now.`,
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
  chooseMethod: "Brew method",
  sources: {
    title: "Sources",
    intro: (methodLabel) => `${methodLabel}'s numbers — ratio, grind, temperature, bloom, and timing — are drawn from these brewing guides.`,
    close: "Close",
  },
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
