import { BarChart3, Landmark, PiggyBank } from 'lucide-react';
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
    { path: '/budget', component: lazy(() => import('./pages/MonthPage').then((m) => ({ default: m.MonthPage }))) },
    { path: '/budget/accounts', component: lazy(() => import('./pages/AccountsPage').then((m) => ({ default: m.AccountsPage }))) },
    { path: '/budget/accounts/debts/:id', component: lazy(() => import('./pages/DebtDetailPage').then((m) => ({ default: m.DebtDetailPage }))) },
    { path: '/budget/analysis', component: lazy(() => import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage }))) },
  ],
  nav: [
    { id: 'month', label: 'Budget', shortLabel: 'Maand', icon: PiggyBank, path: '/budget', placement: 'primary', order: 10, exact: true },
    { id: 'accounts', label: 'Rekeningen', icon: Landmark, path: '/budget/accounts', placement: 'primary', order: 11 },
    { id: 'analysis', label: 'Analyse', icon: BarChart3, path: '/budget/analysis', placement: 'primary', order: 12 },
  ],
};
