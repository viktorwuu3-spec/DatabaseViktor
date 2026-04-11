import { useCallback, useRef } from "react";

export function useFormNavigation(onSubmit?: () => void) {
  const formRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;

      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();

      if (tagName === "textarea" && !e.shiftKey) {
        e.preventDefault();
      } else if (tagName === "textarea" && e.shiftKey) {
        return;
      }

      if (tagName === "button") return;

      e.preventDefault();

      const container = formRef.current;
      if (!container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]):not([type="checkbox"]), select:not([disabled]), textarea:not([disabled])'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
      });

      const currentIndex = focusable.indexOf(target as HTMLElement);

      if (currentIndex === -1) return;

      if (currentIndex < focusable.length - 1) {
        focusable[currentIndex + 1].focus();
      } else {
        onSubmit?.();
      }
    },
    [onSubmit]
  );

  return { formRef, handleKeyDown };
}
