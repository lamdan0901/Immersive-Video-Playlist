"use client";

import { useEffect, useRef, useState } from "react";

const CACHE_NAME = "playlist-banners";

export function useCachedImage(imageUrl: string | null): string | null {
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setCachedUrl(null);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!imageUrl) return;
      try {
        if (typeof caches === "undefined") {
          throw new Error("Cache API not available");
        }

        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(imageUrl);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          if (!cancelled) {
            objectUrlRef.current = URL.createObjectURL(blob);
            setCachedUrl(objectUrlRef.current);
          }
          return;
        }

        const response = await fetch(imageUrl);
        await cache.put(imageUrl, response.clone());
        const blob = await response.blob();

        if (!cancelled) {
          objectUrlRef.current = URL.createObjectURL(blob);
          setCachedUrl(objectUrlRef.current);
        }
      } catch {
        if (!cancelled) {
          setCachedUrl(imageUrl);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [imageUrl]);

  return cachedUrl;
}
