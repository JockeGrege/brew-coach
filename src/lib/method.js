import { useEffect, useState } from "react";
import { METHOD_ORDER, DEFAULT_METHOD } from "./methods";

const METHOD_KEY = "chemex:method";

function loadMethod() {
  try {
    const saved = window.localStorage.getItem(METHOD_KEY);
    return METHOD_ORDER.includes(saved) ? saved : DEFAULT_METHOD;
  } catch {
    return DEFAULT_METHOD;
  }
}

export function useMethod() {
  const [method, setMethod] = useState(loadMethod);

  useEffect(() => {
    try {
      window.localStorage.setItem(METHOD_KEY, method);
    } catch {
      /* ignore */
    }
  }, [method]);

  return [method, setMethod];
}
