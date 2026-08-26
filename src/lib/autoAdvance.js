import { useEffect, useState } from "react";

const KEY = "chemex:autoadvance";

function loadAutoAdvance() {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function useAutoAdvance() {
  const [autoAdvance, setAutoAdvance] = useState(loadAutoAdvance);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, autoAdvance ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, [autoAdvance]);

  return [autoAdvance, setAutoAdvance];
}
