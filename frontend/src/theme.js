import { createTheme } from '@mui/material/styles';

const baseOptions = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
  },
};

export const getTheme = (mode) => {
  return createTheme({
    ...baseOptions,
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            // Palette for Dark mode
            primary: {
              main: '#0ea5e9',
              light: '#38bdf8',
              dark: '#0284c7',
            },
            secondary: {
              main: '#f59e0b',
              light: '#fbbf24',
              dark: '#d97706',
            },
            background: {
              default: '#020617', // Slate 950
              paper: '#0f172a', // Slate 900
            },
            text: {
              primary: '#f8fafc',
              secondary: '#94a3b8',
            },
            divider: '#1e293b',
          }
        : {
            // Palette for Light mode
            primary: {
              main: '#0284c7', // Sky 600
              light: '#0ea5e9',
              dark: '#0369a1',
            },
            secondary: {
              main: '#d97706',
              light: '#f59e0b',
              dark: '#b45309',
            },
            background: {
              default: '#f8fafc', // Slate 50
              paper: '#ffffff',
            },
            text: {
              primary: '#0f172a',
              secondary: '#475569',
            },
            divider: '#e2e8f0',
          }),
    },
    components: {
      ...baseOptions.components,
      MuiCard: {
        styleOverrides: {
          root: {
            ...baseOptions.components.MuiCard.styleOverrides.root,
            boxShadow: mode === 'dark' 
              ? '0 4px 20px rgba(0, 0, 0, 0.4)'
              : '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: `1px solid ${mode === 'dark' ? '#1e293b' : '#e2e8f0'}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            ...baseOptions.components.MuiPaper.styleOverrides.root,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: 'none',
          },
        },
      },
    },
  });
};
