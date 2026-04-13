import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  side?: 'bottom' | 'right';
  children: ReactNode;
};

export function Drawer({ open, title, onClose, side = 'bottom', children }: Props) {
  const position =
    side === 'bottom'
      ? { className: 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl', initial: { y: '100%' } }
      : { className: 'inset-y-0 right-0 w-full max-w-md rounded-l-2xl', initial: { x: '100%' } };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className={`absolute border border-codex-border bg-codex-surface p-4 shadow-2xl ${position.className}`}
            initial={position.initial}
            animate={side === 'bottom' ? { y: 0 } : { x: 0 }}
            exit={position.initial}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button type="button" className="text-sm text-slate-400 hover:text-slate-200" onClick={onClose}>
                Close
              </button>
            </div>
            {children}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
