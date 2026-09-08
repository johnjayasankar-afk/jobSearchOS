/** @type {import('tailwindcss').Config} */
const v = (name) => `hsl(var(--${name}) / <alpha-value>)`

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        subtle: v('subtle'),
        raised: v('raised'),
        line: v('line'),
        'line-strong': v('line-strong'),
        fg: v('fg'),
        muted: v('muted'),
        faint: v('faint'),
        accent: v('accent'),
        'accent-fg': v('accent-fg'),
        'accent-soft': v('accent-soft'),
        positive: v('positive'),
        'positive-soft': v('positive-soft'),
        caution: v('caution'),
        'caution-soft': v('caution-soft'),
        critical: v('critical'),
        'critical-soft': v('critical-soft'),
        info: v('info'),
        'info-soft': v('info-soft'),
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Inter', '"Inter var"', '"SF Pro Text"',
          '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
          '"Apple Color Emoji"', '"Segoe UI Emoji"',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1.0625rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        md: ['0.9375rem', { lineHeight: '1.4375rem' }],
        lg: ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        xl: ['1.25rem', { lineHeight: '1.65rem', letterSpacing: '-0.014em' }],
        '2xl': ['1.5rem', { lineHeight: '1.9rem', letterSpacing: '-0.018em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.022em' }],
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '5px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '14px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 hsl(var(--shadow) / 0.05)',
        sm: '0 1px 2px 0 hsl(var(--shadow) / 0.06), 0 1px 1px -1px hsl(var(--shadow) / 0.08)',
        md: '0 2px 4px -1px hsl(var(--shadow) / 0.08), 0 4px 12px -2px hsl(var(--shadow) / 0.10)',
        lg: '0 8px 24px -6px hsl(var(--shadow) / 0.16), 0 2px 6px -2px hsl(var(--shadow) / 0.10)',
        xl: '0 16px 48px -12px hsl(var(--shadow) / 0.24), 0 4px 12px -4px hsl(var(--shadow) / 0.12)',
        focus: '0 0 0 2px hsl(var(--bg)), 0 0 0 4px hsl(var(--accent) / 0.55)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(-4px) scale(0.985)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'fade-out': 'fade-out 100ms ease-in',
        'scale-in': 'scale-in 130ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-out': 'scale-out 90ms ease-in',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-right': 'slide-out-right 170ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
