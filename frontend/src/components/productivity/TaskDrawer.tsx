import { Drawer } from '../ui/Drawer';
import type { Task } from '../../types';
import { PriorityPip } from '../ui/PriorityPip';

type Props = { task: Task | null; onClose: () => void };

export function TaskDrawer({ task, onClose }: Props) {
  const open = task !== null;
  return (
    <Drawer open={open} title={task?.title ?? 'Task'} onClose={onClose} side="bottom">
      {task ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Priority</span>
            <PriorityPip priority={task.priority} />
          </div>
          <div>
            <span className="text-slate-500">Status</span>
            <p className="capitalize text-slate-200">{task.status.replace('_', ' ')}</p>
          </div>
          {task.description ? (
            <div>
              <span className="text-slate-500">Description</span>
              <p className="text-slate-300">{task.description}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
