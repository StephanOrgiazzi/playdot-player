import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"]
      }
    })
  ],
  resolve: {
    alias: {
      "@app": fileURLToPath(new URL("./src/app", import.meta.url)),
      "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@integrations": fileURLToPath(new URL("./src/integrations", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url))
    }
  },
  optimizeDeps: {
    entries: ["index.html"]
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/old_repo_for_reference/**"]
    }
  }
});
