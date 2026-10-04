import { Home } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

/** Dagelijkse briefing. Niet meer de startpagina, wel bereikbaar via "Meer". */
export const homeModule: ModuleManifest = {
  id: 'home',
  label: 'Start',
  icon: Home,
  description: 'Dagelijkse briefing met weer, agenda, mail en AI-planning.',
  order: 50,
  routes: [
    {
      path: '/home',
      component: lazy(() => import('../../pages/HomePage').then((m) => ({ default: m.HomePage }))),
    },
  ],
  nav: [{ id: 'home', label: 'Start', icon: Home, path: '/home', placement: 'more', order: 50 }],
};
