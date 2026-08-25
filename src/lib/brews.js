import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Brews live at users/{uid}.brews — a single small array, not a subcollection,
// since history is capped at 60 entries and always read/written as a whole.
export async function loadBrews(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data();
  return Array.isArray(data?.brews) ? data.brews : [];
}

export async function saveBrews(uid, brews) {
  try {
    await setDoc(doc(db, "users", uid), { brews }, { merge: true });
    return true;
  } catch {
    return false;
  }
}
