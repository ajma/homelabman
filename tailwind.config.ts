import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/web/**/*.{ts,tsx}'],
  theme: {
    fontSize: {
      '2xs': ['0.75rem',   { lineHeight: '1.125rem' }],
      'xs':  ['0.8125rem', { lineHeight: '1.25rem' }],
      'sm':  ['0.875rem',  { lineHeight: '1.375rem' }],
      'md':  ['0.9375rem', { lineHeight: '1.5rem' }],
      'lg':  ['1.125rem',  { lineHeight: '1.75rem' }],
      'xl':  ['1.375rem',  { lineHeight: '2rem' }],
      '2xl': ['1.6875rem', { lineHeight: '2.25rem' }],
    },
    extend: {
      fontFamily: {
        rubik: ['Rubik', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
