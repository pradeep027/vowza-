import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1440px" },
    },
    extend: {
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          light:   "hsl(var(--gold-light))",
          dark:    "hsl(var(--gold-dark))",
        },
        maroon: {
          DEFAULT: "hsl(var(--maroon))",
          light:   "hsl(var(--maroon-light))",
          dark:    "hsl(var(--maroon-dark))",
        },
        royal: {
          DEFAULT: "hsl(var(--royal))",
          light:   "hsl(var(--royal-light))",
        },
        blush: {
          DEFAULT: "hsl(var(--blush))",
          dark:    "hsl(var(--blush-dark))",
        },
        cream:   "hsl(var(--cream))",
        surface: "hsl(var(--surface))",
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
      },
      maxWidth: {
        "8xl":  "90rem",
        "9xl":  "100rem",
        "10xl": "112rem",
      },
      boxShadow: {
        xs:       "var(--shadow-xs)",
        sm:       "var(--shadow-sm)",
        md:       "var(--shadow-md)",
        lg:       "var(--shadow-lg)",
        xl:       "var(--shadow-xl)",
        "2xl":    "var(--shadow-2xl)",
        gold:     "var(--shadow-gold)",
        maroon:   "var(--shadow-maroon)",
        elevated: "var(--shadow-elevated)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in":     { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up":     { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-down":   { from: { opacity: "0", transform: "translateY(-24px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-right":  { from: { opacity: "0", transform: "translateX(-24px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        "scale-in":    { from: { opacity: "0", transform: "scale(0.95)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer:       { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        float:         { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        "spin-slow":   { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        "pulse-ring":  { "0%": { boxShadow: "0 0 0 0 hsl(40 95% 52% / 0.5)" }, "100%": { boxShadow: "0 0 0 14px hsl(40 95% 52% / 0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.5s ease-out both",
        "fade-up":        "fade-up 0.6s ease-out both",
        "fade-down":      "fade-down 0.5s ease-out both",
        "fade-right":     "fade-right 0.5s ease-out both",
        "scale-in":       "scale-in 0.4s ease-out both",
        shimmer:          "shimmer 2s ease-in-out infinite",
        float:            "float 3.5s ease-in-out infinite",
        "spin-slow":      "spin-slow 20s linear infinite",
        "pulse-ring":     "pulse-ring 2s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
