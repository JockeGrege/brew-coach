import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  linkWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Popup rather than redirect: redirect needs sessionStorage to survive a
// multi-hop cross-origin round trip (app -> authDomain -> Google -> authDomain
// -> app), which privacy-hardened browsers (Brave Shields, strict tracking
// protection) partition or clear, breaking it. Popup avoids that hop chain.
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function continueAsGuest() {
  return signInAnonymously(auth);
}

// Upgrades an anonymous guest session to a real Google account, keeping the
// same uid (and therefore the same Firestore brews) instead of switching to
// a separate one the way a plain signInWithGoogle() would.
export function linkGuestToGoogle() {
  return linkWithPopup(auth.currentUser, googleProvider);
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
