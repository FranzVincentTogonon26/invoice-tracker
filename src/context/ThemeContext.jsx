import { createContext } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
