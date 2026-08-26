import { useEffect, useState } from "react";

export const PALETTES = {
  light: {
    paper: "#E7E5DC",
    card: "#FBFAF6",
    ink: "#1B1D19",
    ink2: "#5F635A",
    ink3: "#8D9086",
    line: "#D3D0C4",
    collar: "#A9773C",
    brew: "#452B18",
    hot: "#9E3B24",
    warn: "#B36B17",
    ok: "#3F6B4A",
  },
  dark: {
    paper: "#171813",
    card: "#211F19",
    ink: "#EDEAE1",
    ink2: "#B4B0A3",
    ink3: "#7E7A6D",
    line: "#39362C",
    collar: "#C6924F",
    brew: "#8A5A31",
    hot: "#E2705A",
    warn: "#E0A458",
    ok: "#6BAE7C",
  },
};

const THEME_KEY = "chemex:theme";

function loadTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return [theme, setTheme];
}
