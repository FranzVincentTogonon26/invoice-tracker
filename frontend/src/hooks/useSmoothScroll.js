import { useEffect, useRef } from "react";

/**
 * Smooth "scrub" wheel scrolling for scrollable panels (modal bodies, lists).
 *
 * Intercepts the wheel event and animates `scrollTop` toward a target with a
 * rAF lerp, turning stepped wheel notches into a smooth eased glide. Native
 * scrolling is left untouched for:
 *   - touch devices (native momentum already feels smooth)
 *   - pinch-zoom gestures (ctrlKey)
 *   - panels without overflow (so the page behind a modal keeps scrolling)
 *
 * Returns a ref to attach to the scrollable element.
 */
export function useSmoothScroll({ lerp = 0.14, wheelMultiplier = 1 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // Touch devices: keep native momentum/elastic scrolling
    if (window.matchMedia?.("(pointer: coarse)").matches) return undefined;

    let target = el.scrollTop;
    let current = el.scrollTop;
    let rafId = null;
    let animating = false;

    const maxScroll = () => el.scrollHeight - el.clientHeight;

    const tick = () => {
      current += (target - current) * lerp;

      // Settle once close enough — avoids an endless sub-pixel loop
      if (Math.abs(target - current) < 0.5) {
        current = target;
        el.scrollTop = current;
        animating = false;
        rafId = null;
        return;
      }

      el.scrollTop = current;
      rafId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (animating) return;
      animating = true;
      current = el.scrollTop;
      rafId = requestAnimationFrame(tick);
    };

    // Wheel deltas arrive in pixels, lines or pages depending on the
    // browser/device — normalize everything to pixels.
    const onWheel = (e) => {
      // Never hijack pinch-zoom
      if (e.ctrlKey) return;
      // Nothing to scroll — let the event pass through untouched
      if (el.scrollHeight <= el.clientHeight) return;

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16; // lines → px
      else if (e.deltaMode === 2) delta *= el.clientHeight; // pages → px
      delta *= wheelMultiplier;

      // Keep the page behind the modal from scrolling
      e.preventDefault();

      target = Math.max(0, Math.min(maxScroll(), target + delta));
      start();
    };

    // Keyboard / programmatic scrolls change scrollTop natively — resync the
    // animation targets when they happen outside our rAF loop.
    const onScroll = () => {
      if (!animating) {
        target = el.scrollTop;
        current = el.scrollTop;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, [lerp, wheelMultiplier]);

  return ref;
}

export default useSmoothScroll;
