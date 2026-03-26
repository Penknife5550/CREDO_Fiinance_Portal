/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // CREDO Corporate Design
        credo: {
          DEFAULT: '#6B7280', // Verwaltung (Grau)
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        // Mandantenfarben
        grundschule: '#2563EB',    // Blau
        gesamtschule: '#059669',   // Grün
        gymnasium: '#DC2626',      // Rot
        berufskolleg: '#7C3AED',   // Violett
        kita: '#F59E0B',           // Amber
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
};
