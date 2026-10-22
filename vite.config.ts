import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Content-Security-Policy, applied to the production HTML only.
 *
 * It cannot live in index.html directly: @vitejs/plugin-react injects an inline
 * module for fast refresh during `npm run dev`, which `script-src 'self'` would
 * block. Injecting at build time keeps the policy strict in production without
 * breaking the dev server.
 *
 * 'unsafe-inline' is required for style-src because React sets style attributes
 * (progress widths, per-subject accent colours). There is no inline script.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

function securityMeta(): Plugin {
  return {
    name: "inject-security-meta",
    apply: "build",
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
            injectTo: "head-prepend",
          },
          {
            tag: "meta",
            attrs: { name: "referrer", content: "no-referrer" },
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

// base: "./" keeps asset URLs relative, so the build works unchanged on
// GitHub Pages project sites, Vercel, Netlify, or any static host / subpath.
export default defineConfig({
  plugins: [react(), securityMeta()],
  base: "./",
  build: {
    // No source maps in the shipped bundle: they would hand an attacker a
    // readable copy of the source. Set to true for local debugging only.
    sourcemap: false,
  },
});
