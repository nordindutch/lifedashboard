import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onDelete?: () => void;
  deleteTitle?: string;
  className?: string;
  /** Merged with default delete button classes (e.g. group-hover opacity on Budget rows). */
  deleteButtonClassName?: string;
}

/**
 * A horizontal flex row used for editable list items in Budget, Accounts, etc.
 * Wraps children with a trailing trash button. Children handle their own
 * input/select/on-blur logic.
 */
export function CrudRow({
  children,
  onDelete,
  deleteTitle = 'Delete',
  className,
  deleteButtonClassName,
}: Props) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {children}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className={`rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 ${deleteButtonClassName ?? ''}`}
          title={deleteTitle}
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}
