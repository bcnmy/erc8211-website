/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#111111',
          900: '#1a1a1a',
          800: '#2a2a2a',
          700: '#404040',
          600: '#555555',
          500: '#717171',
          400: '#8a8a8a',
          300: '#a3a3a3',
          200: '#d4d4d4',
          100: '#ebebeb',
          50: '#f5f5f5',
        },
        page: {
          DEFAULT: '#fafaf9',
          warm: '#f7f6f3',
          cool: '#f8f9fa',
        },
        accent: '#2563eb',
        'accent-light': '#3b82f6',
        'accent-faint': 'rgba(37, 99, 235, 0.06)',
        success: '#16a34a',
        danger: '#dc2626',
      },
      fontFamily: {
        display: ['"Source Serif 4"', '"Iowan Old Style"', 'Palatino', 'Georgia', 'serif'],
        body: ['"Inter"', '"Söhne"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '4.5xl': ['2.5rem', { lineHeight: '1.15' }],
        '5.5xl': ['3.5rem', { lineHeight: '1.1' }],
      },
      maxWidth: {
        article: '720px',
        wide: '960px',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '720px',
          },
        },
      },
    },
  },
  plugins: [],
};
