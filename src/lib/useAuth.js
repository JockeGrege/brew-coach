import { useEffect, useState } from "react";
import { onAuthChange, consumeRedirectResult } from "./firebase";

// user is undefined while Firebase is still resolving the session, null when
// signed out. authError is set when a redirect sign-in came back with a
// failure (wrong authorized domain, provider not enabled, etc).
export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    consumeRedirectResult()
      .then((result) => console.debug("Redirect result:", result))
      .catch((err) => {
        console.error("Google redirect sign-in failed:", err);
        setAuthError(err.message || String(err));
      });
    return onAuthChange((u) => {
      console.debug("Auth state changed:", u);
      setUser(u);
    });
  }, []);

  return { user, authError };
}
