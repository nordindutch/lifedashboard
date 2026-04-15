import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import * as diaryApi from '../../api/diary';
import { useUiStore } from '../../stores/uiStore';
import { Modal } from '../ui/Modal';

const MOOD_EMOJIS: Record<number, string> = {
  1: '😩',
  2: '😞',
  3: '😟',
  4: '😐',
  5: '🙂',
  6: '😊',
  7: '😄',
  8: '😁',
  9: '🤩',
  10: '🥳',
};

export function MoodModal() {
  const open = useUiStore((s) => s.moodModalOpen);
  const closeMoodModal = useUiStore((s) => s.closeMoodModal);
  const qc = useQueryClient();

  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = (): void => {
    setScore(null);
    setNote('');
    setError(null);
    closeMoodModal();
  };

  const handleSubmit = async (): Promise<void> => {
    if (score === null) {
      setError('Pick a mood score first.');
      return;
    }
    setPending(true);
    setError(null);
    const res = await diaryApi.createDiaryLog({
      body: note.trim() || `Mood check-in: ${score}/10`,
      log_type: 'mood',
      mood_score: score,
    });
    setPending(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ['diary'] });
    void qc.invalidateQueries({ queryKey: ['briefing'] });
    handleClose();
  };

  return (
    <Modal open={open} title="How are you feeling?" onClose={handleClose}>
      <div className="space-y-5">
        <div className="flex justify-between gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-center transition-all ${
                score === n ? 'scale-110 bg-amber-500/20 ring-1 ring-amber-500/60' : 'hover:bg-white/5'
              }`}
            >
              <span className="text-xl leading-none">{MOOD_EMOJIS[n]}</span>
              <span className={`text-[10px] font-medium ${score === n ? 'text-amber-300' : 'text-slate-500'}`}>{n}</span>
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="mood-modal-note" className="mb-1 block text-xs text-codex-muted">
            Note (optional)
          </label>
          <input
            id="mood-modal-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSubmit();
              }
            }}
            placeholder="What's influencing your mood?"
            className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
          />
        </div>

        {error ? <p className="text-xs text-rose-400">{error}</p> : null}

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={handleClose} className="text-sm text-codex-muted hover:text-slate-300">
            Skip
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending || score === null}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {pending ? 'Logging…' : 'Log mood'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
