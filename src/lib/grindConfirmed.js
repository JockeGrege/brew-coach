// The grind offset the physical grinder was last confirmed set to, per
// method — kept separate from a brew's own stored grindOffset since the
// brewer may confirm the adjustment (right after seeing a suggestion, or
// before starting the next brew) well before that next brew is actually
// saved.
const KEY = (methodKey) => `chemex:grindconfirmed:${methodKey}`;

export function loadConfirmedGrindOffset(methodKey) {
  try {
    const raw = window.localStorage.getItem(KEY(methodKey));
    return raw !== null ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function saveConfirmedGrindOffset(methodKey, offset) {
  try {
    window.localStorage.setItem(KEY(methodKey), String(offset));
  } catch {
    /* ignore */
  }
}

export function clearConfirmedGrindOffset(methodKey) {
  try {
    window.localStorage.removeItem(KEY(methodKey));
  } catch {
    /* ignore */
  }
}
