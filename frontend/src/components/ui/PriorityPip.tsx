import type { Priority } from '../../types';

const LABELS: Record<Priority, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'P4',
};

export function PriorityPip({ priority }: { priority: Priority }) {
  const tone =
    priority === 1 ? 'bg-red-500' : priority === 2 ? 'bg-amber-500' : 'bg-slate-500';
  return (
    <span
      className={`inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded px-1 text-[10px] font-bold text-white ${tone}`}
      title={`Priority ${priority}`}
    >
      {LABELS[priority]}
    </span>
  );
}
