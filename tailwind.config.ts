import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        'semi-bold': ['Inter', 'system-ui', 'sans-serif'],
        'medium': ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        // ── New token system ──
        ink: {
          DEFAULT: "var(--ink)",
          1: "var(--ink-1)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
          5: "var(--ink-5)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          base: "var(--bg)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
        },
        sage:  { bg: "var(--sage-bg)",  "bg-2": "var(--sage-bg-2)",  fg: "var(--sage-fg)" },
        rose:  { bg: "var(--rose-bg)",  "bg-2": "var(--rose-bg-2)",  fg: "var(--rose-fg)" },
        sky:   { bg: "var(--sky-bg)",   "bg-2": "var(--sky-bg-2)",   fg: "var(--sky-fg)" },
        sand:  { bg: "var(--sand-bg)",  "bg-2": "var(--sand-bg-2)",  fg: "var(--sand-fg)" },
        lav:   { bg: "var(--lav-bg)",   "bg-2": "var(--lav-bg-2)",   fg: "var(--lav-fg)" },
        peach: { bg: "var(--peach-bg)", "bg-2": "var(--peach-bg-2)", fg: "var(--peach-fg)" },
        status: {
          "ai-bg":         "var(--status-ai-bg)",
          "ai-fg":         "var(--status-ai-fg)",
          "waiting-bg":    "var(--status-waiting-bg)",
          "waiting-fg":    "var(--status-waiting-fg)",
          "handover-bg":   "var(--status-handover-bg)",
          "handover-fg":   "var(--status-handover-fg)",
          "aftercare-bg":  "var(--status-aftercare-bg)",
          "aftercare-fg":  "var(--status-aftercare-fg)",
          "review-bg":     "var(--status-review-bg)",
          "review-fg":     "var(--status-review-fg)",
          "resolved-bg":   "var(--status-resolved-bg)",
          "resolved-fg":   "var(--status-resolved-fg)",
        },
      },
      borderRadius: {
        // shadcn defaults — bumped to spec scale
        // sm 6px → buttons/inputs/tags  •  md 10px → cards  •  lg 14px → modals
        sm: "var(--r-sm)",
        md: "calc(var(--radius) - 2px)", // 8px, midpoint
        lg: "var(--radius)",             // 10px
        xl: "var(--r-lg)",               // 14px
        "2xl": "var(--r-xl)",            // 20px
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
      transitionProperty: {
        'smooth': 'var(--transition-smooth)',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
