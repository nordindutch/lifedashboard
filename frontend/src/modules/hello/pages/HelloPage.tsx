import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../components/ui/Card';
import { getHello } from '../api/hello';

export function HelloPage() {
  const q = useQuery({
    queryKey: ['hello'],
    queryFn: async () => {
      const res = await getHello();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-extrabold tracking-tight text-codex-text">Hallo</h1>
      <Card>
        {q.isLoading ? <p className="text-sm text-codex-muted">Laden...</p> : null}
        {q.isError ? <p className="text-sm text-codex-risk">{q.error instanceof Error ? q.error.message : 'Fout'}</p> : null}
        {q.data ? <p className="text-sm text-codex-text">{q.data.message}</p> : null}
      </Card>
    </div>
  );
}
