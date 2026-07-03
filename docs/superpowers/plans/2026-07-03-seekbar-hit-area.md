# Seek Bar Hit Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase the custom M3U8 player seek bar hit area so hover and scrubbing are easier without changing the visible bar or tooltip behavior.

**Architecture:** Keep the outer `.m3u8-player-progress` element as the slider and pointer target, and introduce a single inner `.m3u8-player-progress-track` wrapper so the visible bar can stay vertically centered inside a taller invisible interaction zone. Limit behavior changes to existing player hover and seek logic, and keep the implementation scoped to the player component, its CSS, and one focused regression test for the new wrapper structure.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, CSS

## Global Constraints

- Make the seek bar easier to hover and drag without requiring precise pointer placement on the thin visible bar.
- Preserve the current visual seek bar height in both idle and hover states.
- Preserve the existing hover timestamp tooltip behavior.
- Keep the change small and local to the player styles and any minimal supporting markup needed for centering.
- Do not redesign the player controls.
- Do not change the horizontal seek behavior.
- Do not change the tooltip format or placement concept.
- Users should be able to hover and press within a taller invisible zone around the seek bar.
- Horizontal seek mapping should remain based on the same element bounds and existing ratio logic.
- Hover tooltip behavior should remain unchanged from the current YouTube-like implementation.
- The visible bar should still appear `5px` tall by default and `7px` tall on hover.

## File Structure

- Modify: `src/components/playlist/m3u8-player.tsx`
  - Add one inner track wrapper inside the existing progress element so the visible bar, tooltip, buffer layer, played layer, and thumb can stay centered while the outer element becomes a larger invisible hit target.
- Modify: `src/app/globals.css`
  - Convert `.m3u8-player-progress` into the padded interaction zone, add `.m3u8-player-progress-track` for the visible bar, and keep the existing `5px` idle / `7px` hover bar appearance.
- Modify: `src/components/playlist/m3u8-player.test.tsx`
  - Add one focused regression test that fails until the new centered track wrapper exists, while leaving the existing hover-tooltip and seek tests in place as the primary behavior verification.

---

### Task 1: Enlarge The Seek Bar Hit Area While Preserving Current Behavior

**Files:**
- Modify: `src/components/playlist/m3u8-player.test.tsx:82-121`
- Modify: `src/components/playlist/m3u8-player.tsx:268-296`
- Modify: `src/app/globals.css:122-192`

**Interfaces:**
- Consumes: `M3u8Player({ videoRef }: M3u8PlayerProps): JSX.Element`
- Consumes: `formatPlaybackTime(seconds: number): string`
- Consumes: `getClampedProgressRatio(bar: HTMLDivElement, clientX: number): number` and the existing pointer handlers on `.m3u8-player-progress`
- Produces: `.m3u8-player-progress-track` as a centered visible-bar wrapper nested inside `.m3u8-player-progress`
- Produces: unchanged hover tooltip and seek behavior, but with a taller invisible interaction zone around the bar

- [ ] **Step 1: Write the failing regression test**

Insert this test in `src/components/playlist/m3u8-player.test.tsx` after `it("shows the hovered timestamp above the seek bar", ...)`:

```tsx
it("keeps the slider hit area outside the visible seek track", () => {
  const { container } = renderPlayer();

  const progress = container.querySelector(".m3u8-player-progress");
  const track = container.querySelector(".m3u8-player-progress-track");
  const buffer = container.querySelector(".m3u8-player-progress-buffer");
  const played = container.querySelector(".m3u8-player-progress-played");
  const thumb = container.querySelector(".m3u8-player-progress-thumb");

  expect(progress).toHaveAttribute("role", "slider");
  expect(progress).toContainElement(track);
  expect(track).toContainElement(buffer);
  expect(track).toContainElement(played);
  expect(played).toContainElement(thumb);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npx vitest run src/components/playlist/m3u8-player.test.tsx --testNamePattern "slider hit area outside the visible seek track"
```

Expected: `FAIL` because `.m3u8-player-progress-track` does not exist yet, so the containment assertions fail.

- [ ] **Step 3: Add the minimal wrapper markup and the centered-hit-area CSS**

Replace the existing progress markup block in `src/components/playlist/m3u8-player.tsx` with this version:

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
  <div className="m3u8-player-progress-track">
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
</div>
```

Do not change `getClampedProgressRatio`, `onProgressPointerMove`, or `onProgressPointerDown`; the outer `.m3u8-player-progress` element must remain the element whose bounds drive hover and seek math.

Then replace the existing seek-bar CSS block in `src/app/globals.css` with this version:

```css
.m3u8-player-progress {
  position: relative;
  display: flex;
  align-items: center;
  padding-block: 8px;
  margin-block: -8px;
  cursor: pointer;
  touch-action: none;
}

.m3u8-player-progress-track {
  position: relative;
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
}

.m3u8-player-progress:hover .m3u8-player-progress-track {
  height: 7px;
}

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

.m3u8-player-progress-buffer,
.m3u8-player-progress-played {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
}

.m3u8-player-progress-buffer {
  background: rgba(255, 255, 255, 0.35);
}

.m3u8-player-progress-played {
  background: #f03;
}

.m3u8-player-progress-thumb {
  position: absolute;
  top: 50%;
  right: 0;
  width: 13px;
  height: 13px;
  border-radius: 999px;
  background: #f03;
  transform: translate(50%, -50%) scale(0);
  transition: transform 120ms ease;
}

.m3u8-player-progress:hover .m3u8-player-progress-thumb {
  transform: translate(50%, -50%) scale(1);
}
```

This keeps the horizontal mapping unchanged, enlarges the vertical hit area by `16px` total, prevents visible layout growth with matching negative margins, and keeps the visible bar centered at `5px` idle and `7px` on hover.

- [ ] **Step 4: Run the player test file and verify it passes**

Run:

```bash
npx vitest run src/components/playlist/m3u8-player.test.tsx
```

Expected: `PASS` for the new regression test and the existing hover-tooltip and seek tests.

- [ ] **Step 5: Run the relevant automated verification**

Run:

```bash
npm run lint
npx vitest run src/components/playlist/m3u8-player.test.tsx
```

Expected: `PASS` from ESLint and `PASS` from the focused player suite with no regressions.

- [ ] **Step 6: Manually verify the hit area behavior in the browser**

Run:

```bash
npm run dev
```

Then verify this checklist in playlist detail using an M3U8 video:

```text
1. Hover slightly above the visible seek bar and confirm the timestamp tooltip still appears.
2. Hover slightly below the visible seek bar and confirm the tooltip still appears.
3. Press and drag from slightly above or below the visible bar and confirm the video still scrubs correctly.
4. Confirm the bar still looks 5px tall at rest and 7px tall on hover.
5. Confirm the tooltip styling and placement still match the current behavior.
```

Expected: all five checks succeed without the controls row appearing taller than before.

- [ ] **Step 7: Commit the completed hit-area change**

Run:

```bash
git add src/app/globals.css src/components/playlist/m3u8-player.test.tsx src/components/playlist/m3u8-player.tsx
git commit -m "feat: enlarge seek bar hit area"
```

Expected: one commit containing the centered seek-bar wrapper, CSS hit-area expansion, and regression coverage.
