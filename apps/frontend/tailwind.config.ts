import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rh: {
          bg:       '#0a0a0f',
          surface:  '#12121a',
          card:     '#1a1a26',
          border:   '#2a2a3a',
          accent:   '#6c63ff',
          accent2:  '#00d4aa',
          text:     '#e8e8f0',
          muted:    '#8888aa',
          green:    '#00d4aa',
          red:      '#ff4d6d',
          yellow:   '#ffd60a',
          orange:   '#ff9f1c',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
export default config
