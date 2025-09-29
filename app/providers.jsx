// app/providers.jsx
'use client';

import * as React from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

export const ThemeModeContext = React.createContext({
  mode: 'light',
  toggleMode: () => {},
  setMode: () => {},
});

export default function Providers({ children }) {
  const [mode, setMode] = React.useState('light');
  const theme = React.useMemo(() => createTheme({ palette: { mode } }), [mode]);

  const ctx = React.useMemo(
    () => ({
      mode,
      toggleMode: () => setMode(m => (m === 'light' ? 'dark' : 'light')),
      setMode,
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
