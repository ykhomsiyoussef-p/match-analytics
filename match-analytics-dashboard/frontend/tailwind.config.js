/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          900: '#0a1210',
          800: '#111c19',
          700: '#182622',
          600: '#22352f',
        },
        mint: {
          300: '#a7efc3',
          400: '#7be0a4',
          500: '#4cc884',
        },
        chalk: {
          DEFAULT: '#e8f1ec',
          muted: '#8aa196',
        },
        away: '#f2b866',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
