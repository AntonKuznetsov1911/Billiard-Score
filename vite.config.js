import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

// Content-Security-Policy for the built app: code only from the app itself,
// network only to the app and the club server. Even if some injected markup
// slipped through, it couldn't load scripts or send data anywhere else.
function contentSecurityPolicy(supabaseUrl) {
  let api = "";
  try {
    const u = new URL(supabaseUrl);
    api = ` ${u.origin} wss://${u.host}`;
  } catch (e) {
    // clubs not configured — the app talks to no server at all
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${api}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      react(),
      contentSecurityPolicy(env.VITE_SUPABASE_URL),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["icons/apple-touch-icon.png"],
        manifest: {
          id: "./",
          name: "Твой бильярд",
          short_name: "Бильярд",
          description: "Учёт партий, счёта и статистики в русском бильярде и пуле",
          theme_color: "#0A2B20",
          background_color: "#0A2B20",
          display: "standalone",
          orientation: "portrait",
          start_url: "./",
          scope: "./",
          lang: "ru",
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          // Everything the app needs (fonts and the Telegram script included) is
          // served from its own origin and precached, so it starts without
          // reaching any third-party host — with or without a VPN.
          globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        },
      }),
    ],
    base: "./",
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  };
});
