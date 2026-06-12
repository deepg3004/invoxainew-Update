// InvoxAI "Sunset Gradient" design system — the single source of truth for tokens.
// Apps consume this via `presets: [invoxPreset]` in their tailwind.config.ts.
// Light theme: warm white surfaces, orange→pink→violet sunset accents.
// Deliberately untyped (no `tailwindcss` import) so any app can import it
// without that type needing to resolve from this package; apps cast to Config.
export const invoxPreset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand — sunset
        brand: {
          DEFAULT: "#EC4899", // primary pink
          strong: "#DB2777", // hover / pressed / text-on-light
          soft: "#F472B6",
        },
        flame: { DEFAULT: "#F97316" }, // sunset orange
        accent: { DEFAULT: "#8B5CF6" }, // violet
        // Legacy token name kept (used ~78×) but recoloured violet to fit sunset.
        cyan: { DEFAULT: "#7C3AED" },
        gold: { DEFAULT: "#F59E0B" }, // premium

        // Surfaces (LIGHT — only ever used as backgrounds)
        ink: "#FFFBF8", // page background (warm white)
        surface: "#FFFFFF", // card
        hairline: "#F1E7E0", // border

        // Text
        muted: "#78716C", // secondary text (warm gray, readable on light)

        // Status
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["var(--font-sora)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        // Soft, warm shadows for a light surface
        glow: "0 1px 2px rgba(0,0,0,0.05), 0 16px 40px -16px rgba(236,72,153,0.40)",
        "glow-cyan": "0 16px 40px -18px rgba(139,92,246,0.40)",
        card: "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px -18px rgba(0,0,0,0.18)",
      },
      backgroundImage: {
        // Orange→pink→violet sunset gradient for headlines / buttons
        "brand-gradient": "linear-gradient(100deg, #F97316 0%, #EC4899 50%, #8B5CF6 100%)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-16px)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0)" },
          "60%": { transform: "scale(1.15)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        float: "float 9s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        pop: "pop 0.5s cubic-bezier(0.2,0.8,0.2,1) both",
      },
    },
  },
};

export default invoxPreset;
