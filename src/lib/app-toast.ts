const DEFAULT_DURATION_MS = 3200;

type ToastListener = (message: string | null) => void;

let currentMessage: string | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<ToastListener>();

function emit(message: string | null) {
  currentMessage = message;
  for (const listener of listeners) {
    listener(message);
  }
}

export function getAppToastMessage() {
  return currentMessage;
}

export function subscribeAppToast(listener: ToastListener) {
  listeners.add(listener);
  listener(currentMessage);
  return () => {
    listeners.delete(listener);
  };
}

/** Notify the root toast host. Survives page remounts (host lives in layout). */
export function showAppToast(
  message: string,
  durationMs = DEFAULT_DURATION_MS,
): void {
  if (hideTimer != null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  emit(message);

  hideTimer = setTimeout(() => {
    emit(null);
    hideTimer = null;
  }, durationMs);
}

/** Clear toast immediately (tests / dismiss). */
export function clearAppToast(): void {
  if (hideTimer != null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  emit(null);
}
