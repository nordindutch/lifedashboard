import { PiggyBank } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

export const budgetModule: ModuleManifest = {
  id: 'budget',
  label: 'Budget',
  icon: PiggyBank,
  description: 'Maandbudget, rekeningen, schulden en analyse.',
  order: 10,
  core: true,
  routes: [
    {
      path: '/budget',
      component: lazy(() => import('../../pages/BudgetPage').then((m) => ({ default: m.BudgetPage }))),
    },
  ],
  nav: [
    { id: 'month', label: 'Budget', icon: PiggyBank, path: '/budget', placement: 'primary', order: 10, exact: true },
  ],
};
