/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'confetti-pop': {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '0' },
          '50%': { transform: 'scale(1.2) rotate(180deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(360deg)', opacity: '1' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-20px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(300px) rotate(720deg)', opacity: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(99,102,241,0)' },
        },
        'recording-pulse': {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239,68,68,0.5)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 12px rgba(239,68,68,0)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'progress-fill': {
          '0%': { width: '0%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'spin-slow': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        'flame': {
          '0%, 100%': { transform: 'rotate(-2deg) scale(1)' },
          '50%':      { transform: 'rotate(2deg) scale(1.06)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'slide-in-right': 'slide-in-right 0.35s ease-out',
        'slide-in-left': 'slide-in-left 0.35s ease-out',
        'slide-in-down': 'slide-in-down 0.3s ease-out',
        'scale-in': 'scale-in 0.25s ease-out',
        'pop-in': 'pop-in 0.4s cubic-bezier(.36,1.2,.5,1)',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(.36,1.2,.5,1)',
        'shake': 'shake 0.4s ease-in-out',
        'confetti-pop': 'confetti-pop 0.6s cubic-bezier(.36,1.2,.5,1)',
        'confetti-fall': 'confetti-fall 1.5s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'recording-pulse': 'recording-pulse 1.5s ease-in-out infinite',
        'count-up': 'count-up 0.4s ease-out',
        'progress-fill': 'progress-fill 0.8s ease-out',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'spin-slow': 'spin-slow 22s linear infinite',
        'flame':     'flame 1.6s ease-in-out infinite',
        'pulse-soft':'pulse-soft 2.4s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        editorial: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Display-grade sizes with baked-in line-height
        'display-xl': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display':    ['2.75rem', { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '800' }],
        'h1':         ['2rem',    { lineHeight: '1.15', letterSpacing: '-0.02em',  fontWeight: '800' }],
        'h2':         ['1.5rem',  { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
        'h3':         ['1.25rem', { lineHeight: '1.3',  letterSpacing: '-0.01em',  fontWeight: '700' }],
        'h4':         ['1.0625rem', { lineHeight: '1.35', fontWeight: '600' }],
        'body-lg':    ['1rem',    { lineHeight: '1.6' }],
        'body':       ['0.9375rem', { lineHeight: '1.55' }],
        'caption':    ['0.8125rem', { lineHeight: '1.45' }],
        'eyebrow':    ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      colors: {
        // ── Primary: Indigo-Violet ──────────────────────────
        primary: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // ── Accent: Coral for special moments (achievements, featured) ──
        accent: {
          50:  "#fef7ee",
          100: "#fdedd4",
          200: "#fad8a8",
          300: "#f7bc71",
          400: "#f49a42",
          500: "#f07d1e",
          600: "#e16314",
          700: "#ba4a14",
          800: "#943c18",
          900: "#783317",
        },
        // ── Semantic colors ─────────────────────────────────
        success: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
          400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857",
          800: "#065f46", 900: "#064e3b",
        },
        danger: {
          50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af",
          400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c",
          800: "#9f1239", 900: "#881337",
        },
        warn: {
          50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d",
          400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309",
          800: "#92400e", 900: "#78350f",
        },
        info: {
          50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc",
          400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1",
          800: "#075985", 900: "#0c4a6e",
        },
        // ── Surface: Slate-based for richer backgrounds ─────
        surface: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        // ── Paper / Ink (editorial moments, dark hero panels) ──
        paper: {
          50:  "#fbfaf6",
          100: "#f5f2ea",
          200: "#ebe6d8",
          300: "#d9d2bf",
          400: "#a8a08a",
          500: "#7a7361",
          600: "#5d5848",
        },
        ink: {
          700: "#2a2a2e",
          800: "#1a1a1c",
          900: "#0f0f10",
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(15,23,42,0.04), 0 1px 2px -1px rgba(15,23,42,0.03)',
        'card-hover': '0 12px 28px -6px rgba(15,23,42,0.08), 0 4px 10px -4px rgba(15,23,42,0.04)',
        'card-elevated': '0 24px 48px -12px rgba(15,23,42,0.12), 0 8px 16px -8px rgba(15,23,42,0.08)',
        'glow-primary': '0 0 24px -4px rgba(99,102,241,0.35)',
        'glow-success': '0 0 24px -4px rgba(16,185,129,0.35)',
        'glow-danger':  '0 0 24px -4px rgba(244,63,94,0.35)',
        'glow-accent':  '0 0 24px -4px rgba(240,125,30,0.35)',
        'inner-highlight': 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)',
        'gradient-accent':  'linear-gradient(135deg, #f49a42 0%, #f07d1e 50%, #e16314 100%)',
        'gradient-success': 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
        'gradient-mesh':    'radial-gradient(at 20% 20%, rgba(99,102,241,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(240,125,30,0.1) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(16,185,129,0.12) 0px, transparent 50%)',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
