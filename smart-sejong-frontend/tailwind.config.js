/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7f3',
          100: '#dcede4',
          200: '#b9dbc9',
          300: '#8ec3a8',
          400: '#63a885',
          500: '#4a8768',
          600: '#3d7258',
          700: '#315c47',
          800: '#27483a',
          900: '#1f3a2f',
        },
        sage: '#4a8768',
        navy: '#31465d',
        burgundy: '#6f4141',
        gold: '#a8793d',
        cream: '#f2eee8',
        'cream-dark': '#e7e0d7',
        warm: {
          50: '#f5f5f4',
          100: '#f2eee8',
          200: '#e7e0d7',
          300: '#d0c8bf',
          400: '#b0a8a0',
          500: '#7a7169',
          600: '#5c5550',
          700: '#454140',
          800: '#312f2e',
          900: '#25231f',
        },
      },
      fontFamily: {
        sans: ['SeoulAlrim', 'Pretendard Variable', 'Noto Sans KR', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        card: '0 16px 42px rgba(38, 32, 25, 0.12)',
        'card-sm': '0 8px 24px rgba(38, 32, 25, 0.08)',
        'card-lg': '0 24px 64px rgba(38, 32, 25, 0.16)',
      },
    },
  },
  plugins: [],
}
