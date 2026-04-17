import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import * as diaryApi from '../api/diary';
import { DiaryDaySummaryColumn } from '../components/diary/DiaryDaySummaryColumn';
import { LogFeed } from '../components/diary/LogFeed';
import { QuickLogBar } from '../components/diary/QuickLogBar';
import { useDiaryLogs } from '../hooks/useDiary';
import type { LogType } from '../types';

export function DiaryPage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const q = useDiaryLogs({ date: selectedDate });

  const logEmptyDescription = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (selectedDate === today) {
      return 'Capture thoughts with the quick log bar below.';
    }
    return 'Switch back to today or pick another day to see other entries.';
  }, [selectedDate]);

  const onSubmit = async (body: string, logType: LogType) => {
    const res = await diaryApi.createDiaryLog({ body, log_type: logType });
    if (res.success) {
      void qc.invalidateQueries({ queryKey: ['diary'] });
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-40 md:pb-28">
      <h1 className="text-xl font-semibold text-slate-100">Diary</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="flex min-h-0 flex-col gap-4">
          {q.isLoading ? <p className="text-sm text-slate-400">Loading…</p> : null}
          {!q.isLoading ? (
            <LogFeed logs={q.data ?? []} emptyDescription={logEmptyDescription} />
          ) : null}
          <QuickLogBar onSubmit={onSubmit} />
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start" aria-label="Day summaries">
          <DiaryDaySummaryColumn date={selectedDate} hasLogs={(q.data?.length ?? 0) > 0} onDateChange={setSelectedDate} />
        </aside>
      </div>
    </div>
  );
}
