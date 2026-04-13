import { useQueryClient } from '@tanstack/react-query';
import { LogFeed } from '../components/diary/LogFeed';
import { QuickLogBar } from '../components/diary/QuickLogBar';
import { useDiaryLogs } from '../hooks/useDiary';
import * as diaryApi from '../api/diary';
import type { LogType } from '../types';

export function DiaryPage() {
  const qc = useQueryClient();
  const q = useDiaryLogs();

  const onSubmit = async (body: string, logType: LogType) => {
    const res = await diaryApi.createDiaryLog({ body, log_type: logType });
    if (res.success) {
      void qc.invalidateQueries({ queryKey: ['diary'] });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4 p-4 pb-40 md:pb-28">
      <h1 className="text-xl font-semibold">Diary</h1>
      {q.isLoading ? <p className="text-sm text-slate-400">Loading…</p> : <LogFeed logs={q.data ?? []} />}
      <QuickLogBar onSubmit={onSubmit} />
    </div>
  );
}
