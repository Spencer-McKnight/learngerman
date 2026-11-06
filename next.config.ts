import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // msedge-tts drives a WebSocket (ws) from the TTS route; keep it a
  // runtime require rather than letting webpack bundle it.
  serverExternalPackages: ["msedge-tts"],
};

export default withSerwist(nextConfig);
