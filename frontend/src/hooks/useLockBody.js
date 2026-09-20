import { useEffect } from "react";

/**
 * Reference-counted body scroll lock for modals, dialogs and sheets.
 *
 * While at least one overlay is mounted the page behind it cannot scroll —
 * neither via wheel, touch, keyboard nor scrollbar — and only the scrollable
 * region *inside* the modal moves. The counter keeps nested overlays safe
 * (e.g. ReferencesModal on top of BudgetModal, ConfirmClearDialog on top of
 * ExpensesModal): the body unlocks only after the last overlay unmounts.
 *
 * The lock also compensates for the disappearing OS scrollbar with an equal
 * `padding-right`, so the page behind doesn't jump sideways when a modal
 * opens. Everything is restored once the final lock releases.
 */
let lockCount = 0;
let prevBodyOverflow = "";
let prevBodyPaddingRight = "";
let prevBodyOverscroll = "";
let prevHtmlOverflow = "";

function lockBody() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    prevBodyOverflow = body.style.overflow;
    prevBodyPaddingRight = body.style.paddingRight;
    prevBodyOverscroll = body.style.overscrollBehavior;
    prevHtmlOverflow = html.style.overflow;

    // Compensate for the disappearing scrollbar so the page behind the
    // modal doesn't shift sideways when the lock engages.
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    // Belt-and-braces for iOS Safari, where a body-only lock can still leak
    // scroll gestures into the page behind the modal.
    html.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockBody() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    body.style.overflow = prevBodyOverflow;
    body.style.paddingRight = prevBodyPaddingRight;
    body.style.overscrollBehavior = prevBodyOverscroll;
    html.style.overflow = prevHtmlOverflow;
  }
}

/**
 * Lock body scroll while `active` is true. Prefers the `<LockBodyScroll />`
 * component below (mount-bound, survives exit animations); this hook is for
 * cases where a boolean flag is more convenient.
 */
export function useLockBody(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lockBody();
    return () => {
      unlockBody();
    };
  }, [active]);
}

/**
 * Mount-to-unmount body lock. Render it *inside* the overlay's motion
 * container so the page stays locked through AnimatePresence exit
 * animations, and nested overlays stack correctly via the ref counter.
 *
 *   <motion.div className="fixed inset-0 z-50 ...">
 *     <LockBodyScroll />
 *     ...
 *   </motion.div>
 */
export function LockBodyScroll() {
  useLockBody(true);
  return null;
}

export default useLockBody;
