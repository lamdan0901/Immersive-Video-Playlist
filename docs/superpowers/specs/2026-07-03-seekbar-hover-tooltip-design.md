# Seek Bar Hover Tooltip Design

## Summary

Add a YouTube-like hover tooltip to the custom M3U8 player seek bar in playlist detail. When the user hovers over the progress bar, the player should show the timestamp for the hovered seek position above the bar. The existing custom player styling and behavior must remain intact.

## Goals

- Show a hover timestamp for the seek position under the pointer.
- Match YouTube-style behavior closely for desktop hover interactions.
- Preserve the current custom progress bar, thumb, controls, and fullscreen behavior.
- Keep the change local to the existing player component and CSS.

## Non-Goals

- Add thumbnail preview images.
- Redesign the seek bar or control layout.
- Change touch-first behavior beyond keeping scrubbing intact.

## Recommended Approach

Implement a custom tooltip inside the existing `.m3u8-player-progress` element.

The player will track hover state and hovered progress ratio in `src/components/playlist/m3u8-player.tsx`. On pointer or mouse movement over the seek bar, it will calculate the hovered ratio from the bar bounds, convert that ratio to a hovered timestamp using the current video duration, and render a positioned tooltip above the bar. The tooltip text will use the existing `formatPlaybackTime` helper so formatting stays consistent with the rest of the player UI.

## Component Changes

Update `src/components/playlist/m3u8-player.tsx` to:

- store whether the progress bar is currently hovered
- store the hovered ratio or hovered time derived from the pointer position
- add handlers for enter, move, and leave on the progress bar
- reuse the same ratio clamping rules already used for scrubbing
- render a tooltip element inside the progress bar only when duration is valid and the bar is hovered

The tooltip should be visually tied to the hovered seek point, not to the current playback time.

## Interaction Details

- The tooltip appears only while the pointer is over the progress bar.
- The tooltip follows the hovered seek position horizontally.
- The tooltip text updates continuously as the pointer moves.
- During active scrubbing, the tooltip may remain visible and aligned with the current pointer position so the interaction feels continuous.
- If duration is zero, missing, or not finite, the tooltip stays hidden.
- On touch-only interaction, no separate hover-only UI is required.

## Positioning Rules

The tooltip should be positioned above the progress bar using absolute positioning within `.m3u8-player-progress`.

- Base its horizontal anchor on the hovered ratio.
- Clamp the rendered position so the tooltip does not overflow the left or right edge of the bar.
- Use `pointer-events: none` so the tooltip never blocks hover tracking or scrubbing.

## Styling

Update `src/app/globals.css` with one or more tooltip-specific classes.

Styling should:

- preserve the existing progress bar hover height change
- preserve the existing played-bar and thumb styles
- use a compact floating label above the bar
- use a dark translucent background with readable text
- use tabular numerals for stable timestamp width
- avoid introducing styles that change the rest of the player look

## Testing

Add targeted tests around the player behavior.

- Verify the tooltip is not visible by default.
- Verify hovering the seek bar shows the formatted hovered timestamp.
- Verify the tooltip remains hidden when duration is invalid or unavailable.
- Verify the new behavior does not break existing seek interactions.

## Risks And Mitigations

- Tooltip jitter near the edges: clamp the visual position within the bar bounds.
- Hover logic diverging from seek logic: keep ratio calculation minimal and consistent with existing scrubbing math.
- CSS regressions in the current player style: scope new styles to tooltip classes only.

## Implementation Scope

This change should remain limited to:

- `src/components/playlist/m3u8-player.tsx`
- `src/app/globals.css`
- relevant player tests
