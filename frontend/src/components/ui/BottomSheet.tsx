import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Titel visueel verbergen (bijvoorbeeld bij Snel toevoegen), blijft wel voor schermlezers. */
  hideTitle?: boolean;
};

/**
 * Lade onderin (mobiel) die op desktop als gecentreerd dialoogvenster verschijnt.
 * Toegankelijk: role dialog, aria-modal, Escape sluit, focus gaat naar de lade.
 */
export function BottomSheet({ open, title, onClose, children, hideTitle = false }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type=hidden]), button:not([data-sheet-close]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-sheet border border-[#2c303b] bg-codex-surface shadow-2xl outline-none md:max-w-md md:rounded-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="flex shrink-0 flex-col items-center pt-3" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-[#3a3f4d]" />
            </div>
            <div className={`flex shrink-0 items-center justify-between gap-2 px-5 ${hideTitle ? 'pt-1' : 'pt-3'}`}>
              <h2 id={titleId} className={hideTitle ? 'sr-only' : 'text-xl font-extrabold tracking-tight'}>
                {title}
              </h2>
              <button
                type="button"
                data-sheet-close
                onClick={onClose}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#1d2130] text-[#c8ccd6] hover:text-white ${hideTitle ? 'ml-auto' : ''}`}
                aria-label="Sluiten"
              >
                <X className="h-[18px] w-[18px]" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-3">
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
