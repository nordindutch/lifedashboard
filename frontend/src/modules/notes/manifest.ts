import { StickyNote } from 'lucide-react';
import { lazy } from 'react';
import type { ModuleManifest } from '../types';

export const notesModule: ModuleManifest = {
  id: 'notes',
  label: 'Notities',
  icon: StickyNote,
  description: 'Notities met labels, gekoppeld aan projecten en taken.',
  order: 30,
  routes: [
    {
      path: '/notes',
      component: lazy(() => import('../../pages/NotesPage').then((m) => ({ default: m.NotesPage }))),
    },
  ],
  nav: [{ id: 'notes', label: 'Notities', icon: StickyNote, path: '/notes', placement: 'secondary', order: 30 }],
};
