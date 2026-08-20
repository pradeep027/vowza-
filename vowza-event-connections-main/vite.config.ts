import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  esbuild: {
    // Strip console.log and console.debug in production to prevent info leakage
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    // Keep console.error and console.warn in production for error reporting
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug'] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ["react", "react-dom", "react-router-dom"],
          query:   ["@tanstack/react-query"],
          ui:      ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs"],
          charts:  ["recharts"],
          motion:  ["framer-motion"],
          supabase:["@supabase/supabase-js"],
        },
      },
    },
  },
});
