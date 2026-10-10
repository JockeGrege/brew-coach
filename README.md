# Brew Coach

A guided pour-over brewing coach for Chemex, V60, and Kalita: dial in a recipe, walk through the brew with a timer, log how it tasted, and get the next recipe tuned from that feedback. Runs as an installable PWA, with light/dark theming and Swedish/English language support.

## Features

- **Three brew methods** — Chemex, V60, and Kalita, each with its own recipe/timing logic ([src/lib/methods/](src/lib/methods/)).
- **Feedback-driven coaching** — after each brew, rate the taste and the app adjusts grind, temperature, or ratio for the next one.
- **Brew history** — past brews sync via Firebase (Google sign-in or anonymous guest mode) so recipes improve over time.
- **Installable PWA** — works offline-capable and can be added to a phone/desktop home screen.
- **Light/dark theme and Swedish/English UI**, both persisted per-browser.

## Develop

```bash
npm install
cp .env.example .env   # fill in your Firebase project's config
npm run dev
```

The dev server runs at `http://localhost:5173/brew-coach/` (note the `/brew-coach/` sub-path, set by `base` in [vite.config.js](vite.config.js)).

## Build

```bash
npm run build
npm run preview
```

## Deploy

Pushes to `main` build and publish to GitHub Pages automatically via [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Enable it once under the repo's **Settings → Pages → Source → GitHub Actions**.

## Firebase

Sign-in (Google or anonymous guest) and brew history sync use Firebase (Authentication + Firestore). Create a Firebase project, enable Google + Anonymous sign-in providers, and set the `VITE_FIREBASE_*` values in `.env` locally and as GitHub Actions secrets for deployment.

### Abuse protection (App Check)

The Firebase web config is public, so anyone can script anonymous sign-ups. [App Check](https://firebase.google.com/docs/app-check) with reCAPTCHA Enterprise makes Firebase reject requests that don't come from this app:

1. Create a score-based reCAPTCHA Enterprise site key (Web, with your GitHub Pages domain and `localhost`) in the Google Cloud console for the Firebase project, then register it under **Firebase console → App Check → Apps**.
2. Set `VITE_RECAPTCHA_SITE_KEY` in `.env` and as a GitHub Actions secret. Without it the app skips App Check, so local dev still works.
3. Deploy, watch the App Check metrics while unenforced, then enforce for **Authentication** and **Cloud Firestore**. Enforcing before the new build is live locks out existing users.
4. For local dev with enforcement on, run `npm run dev`, copy the debug token printed in the browser console, and add it under App Check → Manage debug tokens.

`firestore.rules` also only accepts `{ brews: [...] }` (max 60 entries) on a user's own document. Deploy rule changes with `firebase deploy --only firestore:rules`.
