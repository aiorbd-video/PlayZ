
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-main': 'var(--bg-main)',
        'bg-card': 'var(--bg-card)',
        'bg-nav': 'var(--bg-nav)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
      },
      borderColor: {
        'default': 'var(--border-color)',
      },
      screens: {
        'tv': '1440px',
      }
    },
  },
  plugins: [require('tailwind-scrollbar-hide')],
};

export default config;
