"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { triggerAutoRefresh } from "@/actions/import";

export function AutoRefreshTrigger({ playlistId }: { playlistId?: string }) {
  const router = useRouter();

  useEffect(() => {
    triggerAutoRefresh({ playlistId }).then((result) => {
      if (result.ok && result.data.refreshed > 0) {
        router.refresh();
      }
    }).catch((error) => {
      console.error("Auto-refresh failed:", error);
    });
  }, [playlistId, router]);

  return null;
}
