import { memo, type PointerEvent } from 'react';
import type { Note } from '../../types';

type Props = {
  note: Note;
  onPointerDown?: (e: PointerEvent) => void;
};

export const StickyNote = memo(function StickyNote({ note, onPointerDown }: Props) {
  return (
    <div
      role="note"
      onPointerDown={onPointerDown}
      className="absolute w-60 cursor-grab select-none rounded-lg border border-codex-border p-3 text-sm shadow-md active:cursor-grabbing"
      style={{
        left: note.canvas_x ?? 0,
        top: note.canvas_y ?? 0,
        backgroundColor: note.canvas_color ?? '#fef9c3',
        color: '#1e1b12',
        zIndex: note.canvas_z_index ?? 0,
      }}
    >
      {note.title ? <p className="mb-1 font-semibold">{note.title}</p> : null}
      <p className="whitespace-pre-wrap text-xs opacity-90">{note.body}</p>
    </div>
  );
});
