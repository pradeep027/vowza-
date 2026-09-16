import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    esbuild: {
      // In production: drop debugger statements and strip noisy console.log/info/debug,
      // but KEEP console.error and console.warn so error reporting (e.g. ErrorBoundary)
      // still works in the shipped bundle. `pure` lets the minifier drop these calls
      // since their return values are always unused.
      drop: isProd ? ["debugger"] : [],
      pure: isProd ? ["console.log", "console.info", "console.debug"] : [],
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
  };
});
