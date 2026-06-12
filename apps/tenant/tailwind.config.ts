import type { Config } from "tailwindcss";
import { invoxPreset } from "../../packages/ui/tailwind-preset";

const config: Config = {
  presets: [invoxPreset as unknown as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // Pick up Tailwind classes used inside the shared UI package.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
