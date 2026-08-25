// An in-progress brew (past Setup, with a built recipe) is saved per method
// so switching methods never touches the other one's unfinished brew.
const KEY = (methodKey) => `chemex:inprogress:${methodKey}`;

export function loadInProgress(methodKey) {
  try {
    const raw = window.localStorage.getItem(KEY(methodKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveInProgress(methodKey, snapshot) {
  try {
    window.localStorage.setItem(KEY(methodKey), JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function clearInProgress(methodKey) {
  try {
    window.localStorage.removeItem(KEY(methodKey));
  } catch {
    /* ignore */
  }
}
