// Local-storage-backed key/value store, matching the shape the app already
// expects ({ value } | null from get, boolean success from set) so the swap
// to a synced backend later doesn't touch the call sites.
export async function getItem(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? { value: raw } : null;
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
