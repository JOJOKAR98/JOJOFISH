/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Courier New"', '"Trebuchet MS"', 'Verdana', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 34px rgba(34, 211, 238, 0.28)',
        gold: '0 0 30px rgba(250, 204, 21, 0.35)',
      },
    },
  },
  plugins: [],
};
