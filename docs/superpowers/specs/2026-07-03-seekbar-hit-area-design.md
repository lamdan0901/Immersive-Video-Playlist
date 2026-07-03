# Seek Bar Hit Area Design

## Summary

Increase the vertical interactive area of the custom M3U8 player seek bar so hovering and scrubbing are easier, while keeping the visible seek bar and hover tooltip appearance unchanged.

## Goals

- Make the seek bar easier to hover and drag without requiring precise pointer placement on the thin visible bar.
- Preserve the current visual seek bar height in both idle and hover states.
- Preserve the existing hover timestamp tooltip behavior.
- Keep the change small and local to the player styles and any minimal supporting markup needed for centering.

## Non-Goals

- Redesign the player controls.
- Change the horizontal seek behavior.
- Change the tooltip format or placement concept.

## Recommended Approach

Expand the seek bar's invisible vertical hit area while leaving the visible bar unchanged.

The progress control should gain additional vertical padding so users can hover or press slightly above or below the visible line and still interact with the control. To avoid increasing visible spacing inside the controls area, the extra padding should be balanced with negative vertical margins. The visible bar, buffer layer, played layer, thumb, and tooltip should stay visually centered within that enlarged interaction zone.

## Styling Changes

Update `src/app/globals.css` around the existing `.m3u8-player-progress` styles to:

- add vertical padding to enlarge the interactive area
- add matching negative vertical margins so the surrounding layout does not visibly expand
- keep the visible bar height at its current values
- keep the bar internals centered within the larger interaction zone

If the current absolute-positioned bar layers need a stable reference point for centering, a minimal wrapper may be introduced in `src/components/playlist/m3u8-player.tsx`. If CSS alone is sufficient, prefer no component structure changes.

## Interaction Details

- Users should be able to hover and press within a taller invisible zone around the seek bar.
- Horizontal seek mapping should remain based on the same element bounds and existing ratio logic.
- Hover tooltip behavior should remain unchanged from the current YouTube-like implementation.
- The visible bar should still appear `5px` tall by default and `7px` tall on hover.

## Testing

Add a focused regression check in `src/components/playlist/m3u8-player.test.tsx` if component structure changes are needed. Otherwise, rely on the existing player hover-tooltip and seeking tests plus a full relevant suite run.

Verification should confirm:

- existing seek behavior still works
- hover tooltip behavior still works
- no visual-logic regression is introduced by the larger hit area refactor

## Implementation Scope

This change should remain limited to:

- `src/app/globals.css`
- `src/components/playlist/m3u8-player.test.tsx` only if the DOM structure changes or a focused regression test is added
- `src/components/playlist/m3u8-player.tsx` only if a minimal wrapper is required
