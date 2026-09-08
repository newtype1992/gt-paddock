import { defineConfig, loadEnv } from "vite";
import profileHandler from "./api/gt7-profile.js";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "GRIDSTATS_API_TOKEN",
  ])
    if (env[key]) process.env[key] = env[key];
  return {
    plugins: [
      {
        name: "gt7-profile-api",
        configureServer(server) {
          server.middlewares.use("/api/gt7-profile", profileHandler);
        },
      },
    ],
  };
});
