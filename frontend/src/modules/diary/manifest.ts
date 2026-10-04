import { Calendar } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

export const diaryModule: ModuleManifest = {
  id: 'diary',
  label: 'Dagboek',
  icon: Calendar,
  description: 'Korte logs door de dag heen, met stemming en energie.',
  order: 40,
  routes: [
    {
      path: '/diary',
      component: lazy(() => import('../../pages/DiaryPage').then((m) => ({ default: m.DiaryPage }))),
    },
  ],
  nav: [{ id: 'diary', label: 'Dagboek', icon: Calendar, path: '/diary', placement: 'secondary', order: 40 }],
};
