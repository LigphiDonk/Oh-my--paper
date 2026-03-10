import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri bundles need relative asset URLs so installed apps can resolve files.
export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("react-pdf") || id.includes("pdfjs-dist")) {
            return "pdf";
          }
          if (id.includes("pdf-lib")) {
            return "pdfgen";
          }
          return undefined;
        },
      },
    },
  },
}));
