/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../zmk_runtime_cli/ui/static", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:8760" } },
  test: { environment: "jsdom" },
});
