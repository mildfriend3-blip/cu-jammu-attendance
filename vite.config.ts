import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" keeps asset URLs relative, so the build works unchanged on
// GitHub Pages project sites, Vercel, Netlify, or any static host / subpath.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
