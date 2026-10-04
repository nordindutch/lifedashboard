import { Plus } from 'lucide-react';

/** Vaste plusknop rechtsonder, boven de tabbalk. Alleen mobiel. */
export function Fab({ onClick, label = 'Toevoegen' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-codex-accent text-codex-accent-ink shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform active:scale-95 md:hidden"
      style={{ bottom: 'calc(var(--codex-bottom-nav-height) + 1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <Plus className="h-[26px] w-[26px]" strokeWidth={2.4} aria-hidden />
    </button>
  );
}
