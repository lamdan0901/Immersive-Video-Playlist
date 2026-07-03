# Seek Bar Hover Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a YouTube-like hover timestamp tooltip to the custom M3U8 player seek bar in playlist detail without changing the current player visual language.

**Architecture:** Keep the feature local to `M3u8Player` by tracking a hovered seek ratio in component state, reusing the same ratio-clamping math as scrubbing, and rendering a positioned tooltip inside the existing progress bar. Add focused component tests in a new `m3u8-player.test.tsx` file and limit CSS changes to tooltip-specific selectors in `src/app/globals.css`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, CSS

## Global Constraints

- Show a hover timestamp for the seek position under the pointer.
- Match YouTube-style behavior closely for desktop hover interactions.
- Preserve the current custom progress bar, thumb, controls, and fullscreen behavior.
- Keep the change local to the existing player component and CSS.
- Do not add thumbnail preview images.
- Do not redesign the seek bar or control layout.
- Do not change touch-first behavior beyond keeping scrubbing intact.

## File Structure

- Create: `src/components/playlist/m3u8-player.test.tsx`
  - Add focused component tests for hover tooltip visibility, timestamp formatting, invalid-duration behavior, and basic seek-bar interaction safety.
- Modify: `src/components/playlist/m3u8-player.tsx`
  - Add hovered-ratio state, shared progress-ratio math, hover handlers, and tooltip rendering inside the existing progress bar.
- Modify: `src/app/globals.css`
  - Add tooltip-only styles scoped to the existing `.m3u8-player-progress` area.
- Reference only: `src/components/playlist/format-playback-time.ts`
  - Reuse the existing formatter; do not change it.

---

### Task 1: Add The Hover Timestamp Tooltip

**Files:**
- Create: `src/components/playlist/m3u8-player.test.tsx`
- Modify: `src/components/playlist/m3u8-player.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `formatPlaybackTime(seconds: number): string`
- Consumes: `videoRef: RefObject<HTMLVideoElement | null>` passed into `M3u8Player`
- Produces: `.m3u8-player-progress-tooltip` rendered only while hovering a valid seek bar position
- Produces: `getClampedProgressRatio(bar: HTMLDivElement, clientX: number): number` as the single source of truth for hover and scrub math inside `m3u8-player.tsx`

- [ ] **Step 1: Write the failing test file**

Create `src/components/playlist/m3u8-player.test.tsx` with this content:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { M3u8Player } from "./m3u8-player";

function renderPlayer() {
  const videoRef = createRef<HTMLVideoElement>();
  const view = render(<M3u8Player videoRef={videoRef} />);
  const video = view.container.querySelector("video");
  const progress = view.container.querySelector(".m3u8-player-progress");

  expect(video).not.toBeNull();
  expect(progress).not.toBeNull();

  if (!video || !progress) {
    throw new Error("Expected video and progress elements to render");
  }

  Object.defineProperty(video, "duration", {
    configurable: true,
    value: 120,
  });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    value: 0,
    writable: true,
  });
  Object.defineProperty(video, "volume", {
    configurable: true,
    value: 1,
    writable: true,
  });
  Object.defineProperty(video, "muted", {
    configurable: true,
    value: false,
    writable: true,
  });
  Object.defineProperty(video, "buffered", {
    configurable: true,
    value: {
      length: 0,
      end: () => 0,
    },
  });
  Object.defineProperty(progress, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 6,
      right: 200,
      width: 200,
      height: 6,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(progress, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(progress, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });

  fireEvent.loadedMetadata(video);

  return { ...view, video, progress };
}

describe("M3u8Player", () => {
  it("keeps the hover tooltip hidden by default", () => {
    const { container } = renderPlayer();

    expect(
      container.querySelector(".m3u8-player-progress-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("shows the hovered timestamp above the seek bar", () => {
    const { progress } = renderPlayer();

    fireEvent.pointerMove(progress, { clientX: 50 });

    expect(screen.getByText("0:30")).toBeInTheDocument();
  });

  it("keeps the hover tooltip hidden when the duration is invalid", () => {
    const { container, video, progress } = renderPlayer();

    Object.defineProperty(video, "duration", {
      configurable: true,
      value: Number.NaN,
    });

    fireEvent.durationChange(video);
    fireEvent.pointerMove(progress, { clientX: 80 });

    expect(
      container.querySelector(".m3u8-player-progress-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("still seeks when the progress bar is pressed", () => {
    const { video, progress } = renderPlayer();

    let currentTime = 0;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value) => {
        currentTime = value;
      },
    });

    fireEvent.pointerDown(progress, { clientX: 150, pointerId: 1 });

    expect(currentTime).toBe(90);
  });
});
```

- [ ] **Step 2: Run the new test file and verify it fails for the right reason**

Run:

```bash
npx vitest run src/components/playlist/m3u8-player.test.tsx
```

Expected: `FAIL` because `.m3u8-player-progress-tooltip` is never rendered and the hover timestamp test cannot find `0:30`.

- [ ] **Step 3: Add shared progress-ratio math and hover state to `m3u8-player.tsx`**

Update the imports and add the shared helper near the top of `src/components/playlist/m3u8-player.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

function getClampedProgressRatio(bar: HTMLDivElement, clientX: number) {
  const rect = bar.getBoundingClientRect();

  if (rect.width <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}
```

Add the new state and derived values inside `M3u8Player`:

```tsx
const [hoveredRatio, setHoveredRatio] = useState<number | null>(null);

const hasDuration = duration > 0 && Number.isFinite(duration);
const progressRatio = hasDuration ? currentTime / duration : 0;
const hoveredTime = hoveredRatio !== null && hasDuration ? hoveredRatio * duration : null;
```

Replace the inline ratio math in the existing scrubbing code so hover and scrub use the same helper:

```tsx
const updateHoveredRatio = useCallback((bar: HTMLDivElement, clientX: number) => {
  setHoveredRatio(getClampedProgressRatio(bar, clientX));
}, []);

const clearHoveredRatio = useCallback(() => {
  if (!isScrubbingRef.current) {
    setHoveredRatio(null);
  }
}, []);

const onProgressPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
  if (!hasDuration) {
    return;
  }

  updateHoveredRatio(event.currentTarget, event.clientX);
};

const onProgressPointerLeave = () => {
  clearHoveredRatio();
};
```

- [ ] **Step 4: Render the tooltip and keep scrubbing behavior intact**

Update the progress bar markup and the pointer-down handler in `src/components/playlist/m3u8-player.tsx`.

Use the shared ratio helper inside `onProgressPointerDown`:

```tsx
const onProgressPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
  event.preventDefault();
  const bar = event.currentTarget;
  isScrubbingRef.current = true;
  bar.setPointerCapture(event.pointerId);

  const updateFromClientX = (clientX: number) => {
    const ratio = getClampedProgressRatio(bar, clientX);
    setHoveredRatio(ratio);
    seekToRatio(ratio);
  };

  updateFromClientX(event.clientX);

  const onPointerMove = (moveEvent: PointerEvent) => {
    updateFromClientX(moveEvent.clientX);
  };

  const onPointerUp = () => {
    isScrubbingRef.current = false;
    setHoveredRatio(null);
    bar.releasePointerCapture(event.pointerId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
};
```

Then extend the progress markup to track hover and render the tooltip:

```tsx
<div
  className="m3u8-player-progress"
  role="slider"
  aria-label="Seek"
  aria-valuemin={0}
  aria-valuemax={duration}
  aria-valuenow={currentTime}
  onPointerMove={onProgressPointerMove}
  onPointerLeave={onProgressPointerLeave}
  onPointerDown={onProgressPointerDown}
>
  {hoveredTime !== null ? (
    <span
      className="m3u8-player-progress-tooltip"
      style={
        {
          "--m3u8-player-hover-ratio": hoveredRatio,
        } as CSSProperties
      }
    >
      {formatPlaybackTime(hoveredTime)}
    </span>
  ) : null}

  <div className="m3u8-player-progress-buffer" style={{ width: `${bufferedRatio * 100}%` }} />
  <div className="m3u8-player-progress-played" style={{ width: `${progressRatio * 100}%` }}>
    <span className="m3u8-player-progress-thumb" />
  </div>
</div>
```

- [ ] **Step 5: Add tooltip-only CSS in `src/app/globals.css`**

Insert this block immediately after the existing `.m3u8-player-progress:hover` rule so the tooltip styles stay co-located with the seek bar styles:

```css
.m3u8-player-progress-tooltip {
  --m3u8-player-tooltip-half-width: 28px;

  position: absolute;
  bottom: calc(100% + 10px);
  left: clamp(
    var(--m3u8-player-tooltip-half-width),
    calc(var(--m3u8-player-hover-ratio) * 100%),
    calc(100% - var(--m3u8-player-tooltip-half-width))
  );
  z-index: 1;
  min-width: 56px;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(15, 15, 15, 0.92);
  color: #fff;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  transform: translateX(-50%);
}
```

Do not alter the existing progress height, thumb scale, played bar color, or control layout rules.

- [ ] **Step 6: Run the focused test file and verify it passes**

Run:

```bash
npx vitest run src/components/playlist/m3u8-player.test.tsx
```

Expected: `PASS` for all four `M3u8Player` tests.

- [ ] **Step 7: Run the adjacent playlist player regression suite**

Run:

```bash
npx vitest run src/components/playlist/m3u8-player.test.tsx src/components/playlist/playlist-detail-client.test.tsx
```

Expected: `PASS` with no regressions in the broader playlist player behavior.

- [ ] **Step 8: Commit the completed feature**

Run:

```bash
git add src/components/playlist/m3u8-player.test.tsx src/components/playlist/m3u8-player.tsx src/app/globals.css
git commit -m "feat: add seek hover tooltip"
```

Expected: one commit containing the focused player tooltip tests, component logic, and CSS.
