import React, { createContext, useContext } from 'react';
import { StyleSheet, useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import Colors from '../constants/Colors';
import { setStoredThemePreference } from '../lib/theme-preference';

export type ActiveTheme = 'light' | 'dark';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => Promise<void>;
  activeTheme: ActiveTheme;
  colors: typeof Colors.light;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Empty sheet so the provider subscribes to Unistyles and re-renders on theme change.
const themeSubscription = StyleSheet.create(() => ({}));

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Subscribe to Unistyles so the context updates whenever the theme switches.
  useUnistyles();

  const activeTheme: ActiveTheme = UnistylesRuntime.themeName === 'light' ? 'light' : 'dark';
  const isDarkMode = activeTheme === 'dark';

  const toggleTheme = async () => {
    const nextTheme: ActiveTheme = isDarkMode ? 'light' : 'dark';
    UnistylesRuntime.setTheme(nextTheme);
    await setStoredThemePreference(nextTheme);
  };

  const colors = Colors[activeTheme];

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, activeTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
