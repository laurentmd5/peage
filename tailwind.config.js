/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        toll: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          green: '#10b981',
          blue: '#3b82f6',
          amber: '#f59e0b',
          red: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
