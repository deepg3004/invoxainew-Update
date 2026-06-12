// InvoxAI premium-dark design system — the single source of truth for tokens.
// Apps consume this via `presets: [invoxPreset]` in their tailwind.config.ts.
// Palette is taken verbatim from the product design spec.
// Deliberately untyped (no `tailwindcss` import) so any app can import it
// without that type needing to resolve from this package; apps cast to Config.
export const invoxPreset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: "#7C3AED", // primary violet
          strong: "#6D28D9", // hover / pressed
          soft: "#8B5CF6",
        },
        cyan: { DEFAULT: "#06B6D4" }, // secondary
        accent: { DEFAULT: "#A855F7" },
        gold: { DEFAULT: "#FACC15" }, // premium

        // Surfaces
        ink: "#050816", // page background
        surface: "#0F172A", // card
        hairline: "#1E293B", // border

        // Text
        muted: "#94A3B8", // secondary text

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
        glow: "0 0 0 1px rgba(124,58,237,0.25), 0 20px 60px -20px rgba(124,58,237,0.55)",
        "glow-cyan": "0 20px 60px -25px rgba(6,182,212,0.55)",
        card: "0 24px 60px -30px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        // Violet→cyan headline / button gradient
        "brand-gradient": "linear-gradient(100deg, #7C3AED 0%, #A855F7 45%, #06B6D4 100%)",
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
      },
      animation: {
        float: "float 9s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
};

export default invoxPreset;
