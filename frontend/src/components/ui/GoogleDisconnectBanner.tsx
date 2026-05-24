import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GoogleDisconnectReason } from '../../types';

type Props = {
  reason: GoogleDisconnectReason;
  staleData?: boolean;
};

export function GoogleDisconnectBanner({ reason, staleData = false }: Props) {
  if (reason !== 'expired') {
    return null;
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
      <div className="space-y-1">
        <p className="font-medium">Google-verbinding verlopen</p>
        <p className="text-amber-100/85">
          {staleData
            ? 'Agenda en e-mail hieronder kunnen verouderd zijn. Koppel Google opnieuw om te synchroniseren.'
            : 'Agenda en Gmail synchroniseren niet meer totdat je opnieuw koppelt.'}
        </p>
        <Link to="/settings" className="inline-block font-medium text-amber-300 underline-offset-2 hover:underline">
          Naar Instellingen
        </Link>
      </div>
    </div>
  );
}
