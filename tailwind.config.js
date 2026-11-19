/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        toki: {
          50: '#f4f3ff',
          100: '#ebe9fe',
          200: '#d9d6fe',
          300: '#bdb6fd',
          400: '#9b8cfb',
          500: '#7c61f7',
          600: '#693eef',
          700: '#592ed6',
          800: '#4a26b4',
          900: '#3d2093',
          950: '#1b0e45',
        },
        tiki: {
          slate: '#0f141c',
          card: '#161d28',
          border: '#222d3d',
          accent: '#c99a5e', // carved wood / warm bronze
          gold: '#eab308',
        },
        sink: {
          light: '#fef2f2',
          DEFAULT: '#ef4444',
          dark: '#991b1b',
        },
        upkeep: {
          light: '#fffbeb',
          DEFAULT: '#f59e0b',
          dark: '#92400e',
        },
        productive: {
          light: '#ecfdf5',
          DEFAULT: '#10b981',
          dark: '#065f46',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Cinzel', 'Trajan Pro', 'serif'],
      },
      boxShadow: {
        'totem': '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        'glow-toki': '0 0 25px -5px rgba(124, 97, 247, 0.4)',
        'glow-sink': '0 0 25px -5px rgba(239, 68, 68, 0.4)',
        'glow-productive': '0 0 25px -5px rgba(16, 185, 129, 0.4)',
      }
    },
  },
  plugins: [],
}
