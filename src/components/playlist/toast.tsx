"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getAppToastMessage,
  showAppToast,
  subscribeAppToast,
} from "@/lib/app-toast";

export { showAppToast as toast };

/**
 * Root toast host. Mount once in the app layout.
 * Renders via createPortal to document.body so position is viewport-fixed
 * and independent of playlist page remounts after router.refresh().
 */
export function AppToastHost() {
  const [message, setMessage] = useState<string | null>(getAppToastMessage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return subscribeAppToast(setMessage);
  }, []);

  if (!mounted || !message) {
    return null;
  }

  return createPortal(
    <div
      id="app-corner-toast-root"
      className="app-corner-toast"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>,
    document.body,
  );
}
