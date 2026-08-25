import { useEffect, useState } from "react";
import { onAuthChange } from "./firebase";

// undefined while Firebase is still resolving the session, null when signed out.
export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => onAuthChange(setUser), []);

  return user;
}
