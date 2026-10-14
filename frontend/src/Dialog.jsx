import { useLanguage } from './LanguageContext.jsx';
import React, { useEffect, useRef } from 'react';

export default function Dialog({ children, className, labelledBy, onClose, busy = false }) {
  const { direction } = useLanguage();
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const pending = useRef(busy);
  pending.current = busy;

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current.focus();
    function containFocus(event) {
      if (event.key === 'Escape' && !pending.current) close.current?.();
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(element => !element.disabled && element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    }
    const element = panel.current;
    element.addEventListener('keydown', containFocus);
    return () => {
      document.body.style.overflow = overflow;
      element.removeEventListener('keydown', containFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return <div className="modal-backdrop" dir={direction} onClick={() => !busy && onClose?.()}><section ref={panel} className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} onClick={event => event.stopPropagation()}>{children}</section></div>;
}
