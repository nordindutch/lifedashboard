import type { LucideIcon } from 'lucide-react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * Waar een navigatie-item terechtkomt.
 * - primary: tabbalk op mobiel en bovenste groep in de zijbalk
 * - secondary: onderste groep in de zijbalk, en op mobiel onder "Meer"
 * - more: alleen onder "Meer" (mobiel) en onderaan de zijbalk
 */
export type NavPlacement = 'primary' | 'secondary' | 'more';

export interface ModuleNavItem {
  /** Uniek binnen de module */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Pad waar het item naartoe navigeert */
  path: string;
  placement: NavPlacement;
  /** Lager komt eerder; wordt over alle modules heen gesorteerd */
  order: number;
  /**
   * Padprefixen die dit item als actief markeren. Standaard alleen `path`.
   * Voorbeeld: Maand matcht op `/budget` maar niet op `/budget/accounts`.
   */
  match?: string[];
  /** Exacte match op `path` (geen prefix). Handig voor de hoofdroute van een module. */
  exact?: boolean;
}

export interface ModuleRoute {
  /** React Router pad, bijvoorbeeld `/budget/debts/:id` */
  path: string;
  component: LazyExoticComponent<ComponentType>;
}

export interface ModuleManifest {
  /** Stabiele id, ook gebruikt in de instelling `disabled_modules` */
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Volgorde van de module zelf (voor Instellingen en documentatie) */
  order: number;
  routes: ModuleRoute[];
  nav: ModuleNavItem[];
  /**
   * Alleen tonen als `VITE_FLAG_<FLAG>=true` in de build-omgeving staat.
   * Handig voor modules in ontwikkeling.
   */
  featureFlag?: string;
  /** Kernmodules kunnen niet door de gebruiker worden uitgeschakeld. */
  core?: boolean;
}
