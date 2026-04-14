import { DailyBriefing } from '../components/home/DailyBriefing';

/** Home hub: briefing overview grid (see `DailyBriefing`). */
export function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-codex-bg">
      <DailyBriefing />
    </div>
  );
}
