import type { AppTab } from '../stores/uiStore';

export function pathToTab(path: string): AppTab {
  if (path.startsWith('/tasks')) {
    return 'tasks';
  }
  if (path.startsWith('/canvas')) {
    return 'canvas';
  }
  if (path.startsWith('/diary')) {
    return 'diary';
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
    case 'canvas':
      return '/canvas';
    case 'diary':
      return '/diary';
    case 'settings':
      return '/settings';
    default:
      return '/';
  }
}
