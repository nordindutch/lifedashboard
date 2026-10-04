import { Sparkles } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

/**
 * Minimale voorbeeldmodule. Zie docs/ADD_MODULE.md.
 * Alleen zichtbaar met VITE_FLAG_HELLO=true in de omgeving.
 */
export const helloModule: ModuleManifest = {
  id: 'hello',
  label: 'Hallo',
  icon: Sparkles,
  description: 'Voorbeeldmodule die laat zien welke bestanden een module nodig heeft.',
  order: 900,
  featureFlag: 'HELLO',
  routes: [
    {
      path: '/hello',
      component: lazy(() => import('./pages/HelloPage').then((m) => ({ default: m.HelloPage }))),
    },
  ],
  nav: [{ id: 'hello', label: 'Hallo', icon: Sparkles, path: '/hello', placement: 'more', order: 900 }],
};
