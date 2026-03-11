/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tdc: {
          50: '#e6f0ff',
          100: '#b3d1ff',
          200: '#80b3ff',
          300: '#4d94ff',
          400: '#1a75ff',
          500: '#0047bb',
          600: '#003a99',
          700: '#002d77',
          800: '#002055',
          900: '#001333',
        },
        neural: {
          bg: '#050b14',
          surface: '#0a1628',
          panel: '#0f1d32',
          border: '#1a2d4a',
          accent: '#2db3a6',
          glow: '#00e5ff',
        },
        node: {
          concept: '#0047bb',
          service: '#2db3a6',
          agent: '#e20074',
          tool: '#667eea',
          domain: '#f4bb00',
          tender: '#22c55e',
        },
      },
    },
  },
  plugins: [],
};
