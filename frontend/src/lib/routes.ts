import type { AppTab } from '../stores/uiStore';

export function pathToTab(path: string): AppTab {
  if (path.startsWith('/tasks')) {
    return 'tasks';
  }
  if (path.startsWith('/notes')) {
    return 'notes';
  }
  if (path.startsWith('/diary')) {
    return 'diary';
  }
  if (path.startsWith('/budget')) {
    return 'budget';
  }
  if (path.startsWith('/settings')) {
    return 'settings';
  }
  return 'home';
}

export function tabToPath(tab: AppTab): string {
  switch (tab) {
    case 'tasks':
      return '/tasks';
    case 'notes':
      return '/notes';
    case 'diary':
      return '/diary';
    case 'budget':
      return '/budget';
    case 'settings':
      return '/settings';
    default:
      return '/';
  }
}
