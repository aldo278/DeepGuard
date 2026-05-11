// vite.config.ts
import { defineConfig } from "file:///C:/Users/aantanolopez/CascadeProjects/DeepGuard/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/aantanolopez/CascadeProjects/DeepGuard/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///C:/Users/aantanolopez/CascadeProjects/DeepGuard/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// public/manifest.json
var manifest_default = {
  manifest_version: 3,
  name: "TrustShield - Real-Time Deepfake & Misinformation Detection",
  version: "1.0.0",
  description: "Protect yourself from AI-generated deception with real-time deepfake detection and misinformation fact-checking during video calls, browsing, and video watching.",
  permissions: [
    "activeTab",
    "storage",
    "sidePanel"
  ],
  host_permissions: [
    "https://meet.google.com/*",
    "https://zoom.us/*",
    "https://teams.microsoft.com/*",
    "https://www.youtube.com/*",
    "https://openrouter.ai/api/*",
    "https://claimbuster.api.app/*",
    "https://factchecktools.googleapis.com/*"
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/factcheck.ts"],
      run_at: "document_idle"
    }
  ],
  side_panel: {
    default_path: "src/panel/main.html"
  },
  action: {
    default_title: "Open TrustShield",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  web_accessible_resources: [
    {
      resources: ["models/*.onnx", "src/worker/*.ts"],
      matches: ["<all_urls>"]
    }
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
};

// vite.config.ts
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\aantanolopez\\CascadeProjects\\DeepGuard";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest_default })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "src"),
      "@/components": path.resolve(__vite_injected_original_dirname, "src/components"),
      "@/lib": path.resolve(__vite_injected_original_dirname, "src/lib"),
      "@/types": path.resolve(__vite_injected_original_dirname, "src/types")
    }
  },
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    }
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development")
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicHVibGljL21hbmlmZXN0Lmpzb24iXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhYW50YW5vbG9wZXpcXFxcQ2FzY2FkZVByb2plY3RzXFxcXERlZXBHdWFyZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWFudGFub2xvcGV6XFxcXENhc2NhZGVQcm9qZWN0c1xcXFxEZWVwR3VhcmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2FhbnRhbm9sb3Blei9DYXNjYWRlUHJvamVjdHMvRGVlcEd1YXJkL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IGNyeCB9IGZyb20gJ0Bjcnhqcy92aXRlLXBsdWdpbidcbmltcG9ydCBtYW5pZmVzdCBmcm9tICcuL3B1YmxpYy9tYW5pZmVzdC5qc29uJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgY3J4KHsgbWFuaWZlc3QgfSlcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKSxcbiAgICAgICdAL2NvbXBvbmVudHMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2NvbXBvbmVudHMnKSxcbiAgICAgICdAL2xpYic6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvbGliJyksXG4gICAgICAnQC90eXBlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvdHlwZXMnKSxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5qcycsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uW2V4dF0nXG4gICAgICB9XG4gICAgfVxuICB9LFxuICBkZWZpbmU6IHtcbiAgICAncHJvY2Vzcy5lbnYuTk9ERV9FTlYnOiBKU09OLnN0cmluZ2lmeShwcm9jZXNzLmVudi5OT0RFX0VOViB8fCAnZGV2ZWxvcG1lbnQnKVxuICB9XG59KVxuIiwgIntcbiAgXCJtYW5pZmVzdF92ZXJzaW9uXCI6IDMsXG4gIFwibmFtZVwiOiBcIlRydXN0U2hpZWxkIC0gUmVhbC1UaW1lIERlZXBmYWtlICYgTWlzaW5mb3JtYXRpb24gRGV0ZWN0aW9uXCIsXG4gIFwidmVyc2lvblwiOiBcIjEuMC4wXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJQcm90ZWN0IHlvdXJzZWxmIGZyb20gQUktZ2VuZXJhdGVkIGRlY2VwdGlvbiB3aXRoIHJlYWwtdGltZSBkZWVwZmFrZSBkZXRlY3Rpb24gYW5kIG1pc2luZm9ybWF0aW9uIGZhY3QtY2hlY2tpbmcgZHVyaW5nIHZpZGVvIGNhbGxzLCBicm93c2luZywgYW5kIHZpZGVvIHdhdGNoaW5nLlwiLFxuICBcInBlcm1pc3Npb25zXCI6IFtcbiAgICBcImFjdGl2ZVRhYlwiLFxuICAgIFwic3RvcmFnZVwiLFxuICAgIFwic2lkZVBhbmVsXCJcbiAgXSxcbiAgXCJob3N0X3Blcm1pc3Npb25zXCI6IFtcbiAgICBcImh0dHBzOi8vbWVldC5nb29nbGUuY29tLypcIixcbiAgICBcImh0dHBzOi8vem9vbS51cy8qXCIsXG4gICAgXCJodHRwczovL3RlYW1zLm1pY3Jvc29mdC5jb20vKlwiLFxuICAgIFwiaHR0cHM6Ly93d3cueW91dHViZS5jb20vKlwiLFxuICAgIFwiaHR0cHM6Ly9vcGVucm91dGVyLmFpL2FwaS8qXCIsXG4gICAgXCJodHRwczovL2NsYWltYnVzdGVyLmFwaS5hcHAvKlwiLFxuICAgIFwiaHR0cHM6Ly9mYWN0Y2hlY2t0b29scy5nb29nbGVhcGlzLmNvbS8qXCJcbiAgXSxcbiAgXCJiYWNrZ3JvdW5kXCI6IHtcbiAgICBcInNlcnZpY2Vfd29ya2VyXCI6IFwic3JjL2JhY2tncm91bmQvaW5kZXgudHNcIixcbiAgICBcInR5cGVcIjogXCJtb2R1bGVcIlxuICB9LFxuICBcImNvbnRlbnRfc2NyaXB0c1wiOiBbXG4gICAge1xuICAgICAgXCJtYXRjaGVzXCI6IFtcIjxhbGxfdXJscz5cIl0sXG4gICAgICBcImpzXCI6IFtcInNyYy9jb250ZW50L2ZhY3RjaGVjay50c1wiXSxcbiAgICAgIFwicnVuX2F0XCI6IFwiZG9jdW1lbnRfaWRsZVwiXG4gICAgfVxuICBdLFxuICBcInNpZGVfcGFuZWxcIjoge1xuICAgIFwiZGVmYXVsdF9wYXRoXCI6IFwic3JjL3BhbmVsL21haW4uaHRtbFwiXG4gIH0sXG4gIFwiYWN0aW9uXCI6IHtcbiAgICBcImRlZmF1bHRfdGl0bGVcIjogXCJPcGVuIFRydXN0U2hpZWxkXCIsXG4gICAgXCJkZWZhdWx0X2ljb25cIjoge1xuICAgICAgXCIxNlwiOiBcImljb25zL2ljb24xNi5wbmdcIixcbiAgICAgIFwiNDhcIjogXCJpY29ucy9pY29uNDgucG5nXCIsXG4gICAgICBcIjEyOFwiOiBcImljb25zL2ljb24xMjgucG5nXCJcbiAgICB9XG4gIH0sXG4gIFwiaWNvbnNcIjoge1xuICAgIFwiMTZcIjogXCJpY29ucy9pY29uMTYucG5nXCIsXG4gICAgXCI0OFwiOiBcImljb25zL2ljb240OC5wbmdcIixcbiAgICBcIjEyOFwiOiBcImljb25zL2ljb24xMjgucG5nXCJcbiAgfSxcbiAgXCJ3ZWJfYWNjZXNzaWJsZV9yZXNvdXJjZXNcIjogW1xuICAgIHtcbiAgICAgIFwicmVzb3VyY2VzXCI6IFtcIm1vZGVscy8qLm9ubnhcIiwgXCJzcmMvd29ya2VyLyoudHNcIl0sXG4gICAgICBcIm1hdGNoZXNcIjogW1wiPGFsbF91cmxzPlwiXVxuICAgIH1cbiAgXSxcbiAgXCJjb250ZW50X3NlY3VyaXR5X3BvbGljeVwiOiB7XG4gICAgXCJleHRlbnNpb25fcGFnZXNcIjogXCJzY3JpcHQtc3JjICdzZWxmJyAnd2FzbS11bnNhZmUtZXZhbCc7IG9iamVjdC1zcmMgJ3NlbGYnXCJcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VSxTQUFTLG9CQUFvQjtBQUN0VyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxXQUFXOzs7QUNGcEI7QUFBQSxFQUNFLGtCQUFvQjtBQUFBLEVBQ3BCLE1BQVE7QUFBQSxFQUNSLFNBQVc7QUFBQSxFQUNYLGFBQWU7QUFBQSxFQUNmLGFBQWU7QUFBQSxJQUNiO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxrQkFBb0I7QUFBQSxJQUNsQjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFlBQWM7QUFBQSxJQUNaLGdCQUFrQjtBQUFBLElBQ2xCLE1BQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxpQkFBbUI7QUFBQSxJQUNqQjtBQUFBLE1BQ0UsU0FBVyxDQUFDLFlBQVk7QUFBQSxNQUN4QixJQUFNLENBQUMsMEJBQTBCO0FBQUEsTUFDakMsUUFBVTtBQUFBLElBQ1o7QUFBQSxFQUNGO0FBQUEsRUFDQSxZQUFjO0FBQUEsSUFDWixjQUFnQjtBQUFBLEVBQ2xCO0FBQUEsRUFDQSxRQUFVO0FBQUEsSUFDUixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsTUFDZCxNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxFQUNUO0FBQUEsRUFDQSwwQkFBNEI7QUFBQSxJQUMxQjtBQUFBLE1BQ0UsV0FBYSxDQUFDLGlCQUFpQixpQkFBaUI7QUFBQSxNQUNoRCxTQUFXLENBQUMsWUFBWTtBQUFBLElBQzFCO0FBQUEsRUFDRjtBQUFBLEVBQ0EseUJBQTJCO0FBQUEsSUFDekIsaUJBQW1CO0FBQUEsRUFDckI7QUFDRjs7O0FEbkRBLE9BQU8sVUFBVTtBQUpqQixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixJQUFJLEVBQUUsMkJBQVMsQ0FBQztBQUFBLEVBQ2xCO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsTUFDbEMsZ0JBQWdCLEtBQUssUUFBUSxrQ0FBVyxnQkFBZ0I7QUFBQSxNQUN4RCxTQUFTLEtBQUssUUFBUSxrQ0FBVyxTQUFTO0FBQUEsTUFDMUMsV0FBVyxLQUFLLFFBQVEsa0NBQVcsV0FBVztBQUFBLElBQ2hEO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsTUFDbEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sd0JBQXdCLEtBQUssVUFBVSxRQUFRLElBQUksWUFBWSxhQUFhO0FBQUEsRUFDOUU7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
