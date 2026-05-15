"use client";

import { useEffect } from "react";
import { triggerAutoRefresh } from "@/actions/import";

export function AutoRefreshTrigger({ playlistId }: { playlistId?: string }) {
  useEffect(() => {
    // Trigger auto-refresh after component mounts (after render phase)
    triggerAutoRefresh({ playlistId }).catch((error) => {
      console.error("Auto-refresh failed:", error);
    });
  }, [playlistId]);

  return null;
}
