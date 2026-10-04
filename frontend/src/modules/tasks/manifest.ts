import { LayoutGrid } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

export const tasksModule: ModuleManifest = {
  id: 'tasks',
  label: 'Taken',
  icon: LayoutGrid,
  description: 'Kanban-bord met projecten en doelen.',
  order: 20,
  routes: [
    {
      path: '/tasks',
      component: lazy(() => import('../../pages/ProductivityPage').then((m) => ({ default: m.ProductivityPage }))),
    },
  ],
  nav: [{ id: 'tasks', label: 'Taken', icon: LayoutGrid, path: '/tasks', placement: 'secondary', order: 20 }],
};
