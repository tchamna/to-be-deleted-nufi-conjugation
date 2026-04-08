import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sortie `build/` : même chemin que STATIC_ROOT dans api_nufi_conjugation.py
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
