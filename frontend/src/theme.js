import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  fonts: {
    heading: `'Plus Jakarta Sans', system-ui, sans-serif`,
    body: `'Plus Jakarta Sans', system-ui, sans-serif`,
    mono: `'JetBrains Mono', monospace`,
  },
  colors: {
    brand: {
      50: '#e6f7ff',
      100: '#b3e0ff',
      200: '#80caff',
      300: '#4db3ff',
      400: '#1a9dff',
      500: '#0284c7',
      600: '#026da3',
      700: '#015680',
      800: '#013f5c',
      900: '#002839',
    },
    accent: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
    gold: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === 'dark' ? '#0B1120' : '#F0F4F8',
        color: props.colorMode === 'dark' ? '#E2E8F0' : '#1A202C',
      },
    }),
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 600,
        borderRadius: 'lg',
      },
      variants: {
        solid: (props) => ({
          bg: props.colorScheme === 'brand' ? 'linear-gradient(135deg, #0284c7, #0ea5e9)' : undefined,
          bgGradient: props.colorScheme === 'brand' ? 'linear(to-r, brand.600, brand.500)' : undefined,
          color: 'white',
          _hover: {
            boxShadow: 'lg',
          },
          _active: {
          },
        }),
        glass: (props) => ({
          bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.50',
          backdropFilter: 'blur(8px)',
          border: '1px solid',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.100',
          _hover: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.100',
          },
        }),
      },
    },
    Card: {
      baseStyle: (props) => ({
        container: {
          bg: props.colorMode === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'white',
          border: '1px solid',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.200',
          borderRadius: 'xl',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          _hover: {
            boxShadow: props.colorMode === 'dark' 
              ? '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
              : '0 20px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
            borderColor: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.300',
          },
        },
      }),
    },
    Modal: {
      baseStyle: (props) => ({
        dialog: {
          bg: props.colorMode === 'dark' ? '#0F172A' : 'white',
          border: '1px solid',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.200',
          borderRadius: '2xl',
          boxShadow: props.colorMode === 'dark' 
            ? '0 25px 50px rgba(0,0,0,0.5)'
            : '0 25px 50px rgba(0,0,0,0.12)',
        },
        overlay: {
          bg: 'blackAlpha.700',
          backdropFilter: 'blur(8px)',
        },
      }),
    },
    Table: {
      variants: {
        modern: (props) => ({
          th: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'gray.50',
            color: props.colorMode === 'dark' ? 'gray.400' : 'gray.600',
            fontWeight: 700,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderBottom: '1px solid',
            borderColor: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.200',
            py: 3,
            px: 4,
          },
          td: {
            py: 3,
            px: 4,
            borderBottom: '1px solid',
            borderColor: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'gray.100',
            fontSize: '0.875rem',
          },
          tr: {
            _hover: {
              bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'gray.50',
            },
          },
        }),
      },
    },
    Input: {
      variants: {
        filled: (props) => ({
          field: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'gray.50',
            border: '1px solid',
            borderColor: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.200',
            borderRadius: 'lg',
            _hover: {
              bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.100',
            },
            _focus: {
              bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'white',
              borderColor: 'brand.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
            },
          },
        }),
      },
      defaultProps: {
        variant: 'filled',
      },
    },
    Select: {
      variants: {
        filled: (props) => ({
          field: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'gray.50',
            border: '1px solid',
            borderColor: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.200',
            borderRadius: 'lg',
            _hover: {
              bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.100',
            },
            _focus: {
              bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'white',
              borderColor: 'brand.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
            },
          },
        }),
      },
      defaultProps: {
        variant: 'filled',
      },
    },
    Textarea: {
      variants: {
        filled: (props) => ({
          bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'gray.50',
          border: '1px solid',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.200',
          borderRadius: 'lg',
          _hover: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.100',
          },
          _focus: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'white',
            borderColor: 'brand.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
          },
        }),
      },
      defaultProps: {
        variant: 'filled',
      },
    },
  },
  shadows: {
    glass: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.06)',
    'glass-lg': '0 25px 50px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.08)',
    glow: '0 0 20px rgba(2, 132, 199, 0.25), 0 0 40px rgba(2, 132, 199, 0.1)',
  },
});

export default theme;
