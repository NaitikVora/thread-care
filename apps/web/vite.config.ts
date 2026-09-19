import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  root: path.resolve("apps/web"),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4175", changeOrigin: false } },
  },
  build: { outDir: path.resolve("build/web"), emptyOutDir: true },
});
