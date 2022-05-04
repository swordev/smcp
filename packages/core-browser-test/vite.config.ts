import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    polyfillDynamicImport: false,
  },
  esbuild: {
    keepNames: true,
  },
  resolve: {
    alias: {
      "@smcp/core": resolve(__dirname, "../core/src"),
    },
  },
});
