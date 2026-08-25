# Chemex Brew Coach

A guided Chemex brewing coach: dial in a recipe, walk through the brew with a timer, log how it tasted, and get the next recipe tuned from that feedback. Runs as an installable PWA.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

Pushes to `main` build and publish to GitHub Pages automatically via [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Enable it once under the repo's **Settings → Pages → Source → GitHub Actions**.

## Firebase

Sign-in and brew history sync use Firebase (Google auth + Firestore). See the setup guide for creating a project and configuring `VITE_FIREBASE_*` env vars / GitHub secrets.
