import { useEffect, useState } from "react";
import { onAuthChange, consumeRedirectResult } from "./firebase";

// user is undefined while Firebase is still resolving the session, null when
// signed out. authError is set when a redirect sign-in came back with a
// failure (wrong authorized domain, provider not enabled, etc).
export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    consumeRedirectResult().catch((err) => setAuthError(err.message || String(err)));
    return onAuthChange(setUser);
  }, []);

  return { user, authError };
}
