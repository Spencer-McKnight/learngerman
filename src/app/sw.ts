import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** The offline shell (src/app/~offline/page.tsx), served for any page navigation the network cannot answer. */
const OFFLINE_URL = "/~offline";

const manifest = self.__SW_MANIFEST ?? [];

/**
 * A revision for the offline page derived from the build's own manifest,
 * so the shell is re-fetched whenever a deploy changes any asset and is
 * otherwise served straight from the precache.
 */
function manifestRevision(entries: (PrecacheEntry | string)[]): string {
  let hash = 5381;
  for (const entry of entries) {
    const key = typeof entry === "string" ? entry : `${entry.url}@${entry.revision ?? ""}`;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

const serwist = new Serwist({
  precacheEntries: [...manifest, { url: OFFLINE_URL, revision: manifestRevision(manifest) }],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
