import { Settings } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

export const settingsModule: ModuleManifest = {
  id: 'settings',
  label: 'Instellingen',
  icon: Settings,
  order: 90,
  core: true,
  routes: [
    {
      path: '/settings',
      component: lazy(() => import('../../pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))),
    },
  ],
  nav: [{ id: 'settings', label: 'Instellingen', icon: Settings, path: '/settings', placement: 'secondary', order: 90 }],
};
