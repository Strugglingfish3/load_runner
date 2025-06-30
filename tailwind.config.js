/** @type {import('tailwindcss').Config} */
export default {
  // This 'content' array is the most important part.
  // It tells Tailwind to scan all your HTML files and all your JavaScript
  // files inside the 'src' directory for any Tailwind classes.
  content: [
    "./*.html", // Scans index.html, manager.html, timer.html
    "./src/**/*.{js,ts,jsx,tsx}", // Scans all JS files in the src folder
  ],
  theme: {
    extend: {
      fontFamily: {
        // This ensures your Inter font is configured correctly.
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
