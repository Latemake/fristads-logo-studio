import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
  returnFocus,
}) {
  const dialog = useRef();
  useEffect(() => {
    const previous = returnFocus || document.activeElement,
      bodyOverflow = document.body.style.overflow;
    const main = document.querySelector("main"),
      header = document.querySelector("header");
    if (main) main.inert = true;
    if (header) header.inert = true;
    document.body.style.overflow = "hidden";
    const focusable = () => [
      ...dialog.current.querySelectorAll(
        'button:not(:disabled), input, a[href], select, textarea, [tabindex="0"]',
      ),
    ];
    (
      dialog.current.querySelector("[data-autofocus]") ||
      focusable()[0] ||
      dialog.current
    ).focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const nodes = focusable(),
        first = nodes[0],
        last = nodes.at(-1);
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = bodyOverflow;
      if (main) main.inert = false;
      if (header) header.inert = false;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialog}
        className={"modal " + (wide ? "modal-wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <button
          className="icon-button modal-close"
          aria-label="Sulje"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
