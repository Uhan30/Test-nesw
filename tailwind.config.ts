import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#F2C811', // Power BI yellow accent
          dark: '#D9AE00',
        },
        ink: '#13253C',
      },
    },
  },
  plugins: [],
};

export default config;
