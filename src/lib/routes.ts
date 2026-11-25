import type { ClientPortalTab } from '../components/client/ClientPortalView';
import { SITE_ORIGIN, parseSampleRouteFromLocation } from './sampleSeo';
import { normalizeOrderCode } from './utils';

export type PortalMode = 'select' | 'admin' | 'client';

export type AdminTabKey =
  | 'orders'
  | 'calendar'
  | 'ai_writer'
  | 'data_lab'
  | 'humanizer'
  | 'clients'
  | 'revenue'
  | 'team'
  | 'settings';

export interface ParsedAppRoute {
  mode: PortalMode;
  rolePage: 'home' | 'samples';
  clientTab: ClientPortalTab;
  orderCode: string;
  adminTab: AdminTabKey | null;
}

const ADMIN_TAB_SLUGS: Record<AdminTabKey, string> = {
  orders: 'orders',
  calendar: 'calendar',
  ai_writer: 'ai-writer',
  data_lab: 'data-lab',
  humanizer: 'humanizer',
  clients: 'clients',
  revenue: 'revenue',
  team: 'team',
  settings: 'settings',
};

const SLUG_TO_ADMIN_TAB: Record<string, AdminTabKey> = {
  orders: 'orders',
  calendar: 'calendar',
  'ai-writer': 'ai_writer',
  ai_writer: 'ai_writer',
  'data-lab': 'data_lab',
  data_lab: 'data_lab',
  humanizer: 'humanizer',
  clients: 'clients',
  revenue: 'revenue',
  team: 'team',
  settings: 'settings',
};

export function parseAppRoute(loc: Location = window.location): ParsedAppRoute {
  const pathname = loc.pathname.replace(/\/+$/, '') || '/';
  const lowerPath = pathname.toLowerCase();
  const params = new URLSearchParams(loc.search);
  const codeParam = params.get('code') || '';
  const normalizedCode = codeParam ? normalizeOrderCode(codeParam) : '';
  const portalParam = params.get('portal');
  const tabParam = params.get('tab');

  // 1. Clean path-based routes for Admin & all sub-tabs (/admin, /admin/<slug>)
  if (lowerPath === '/admin' || lowerPath.startsWith('/admin/')) {
    const sub = lowerPath.slice('/admin'.length).replace(/^\/+/, '');
    const adminTab =
      SLUG_TO_ADMIN_TAB[sub] ||
      (tabParam && SLUG_TO_ADMIN_TAB[tabParam]) ||
      null;
    return {
      mode: 'admin',
      rolePage: 'home',
      clientTab: 'lookup',
      orderCode: '',
      adminTab,
    };
  }

  // 2. Clean path-based routes for Client tabs (/dat-bai, /tra-cuu, /check-ai)
  if (lowerPath === '/dat-bai' || lowerPath === '/order') {
    return {
      mode: 'client',
      rolePage: 'home',
      clientTab: 'order',
      orderCode: '',
      adminTab: null,
    };
  }

  if (lowerPath === '/tra-cuu' || lowerPath === '/track' || lowerPath === '/lookup') {
    return {
      mode: 'client',
      rolePage: 'home',
      clientTab: 'lookup',
      orderCode: normalizedCode,
      adminTab: null,
    };
  }

  if (lowerPath === '/check-ai' || lowerPath === '/checker') {
    return {
      mode: 'client',
      rolePage: 'home',
      clientTab: 'checker',
      orderCode: '',
      adminTab: null,
    };
  }

  // 3. SEO & Samples paths (/samples, /samples/<slug>, /uni/<school>)
  if (parseSampleRouteFromLocation(loc).isSamplesRoute) {
    return {
      mode: 'select',
      rolePage: 'samples',
      clientTab: 'lookup',
      orderCode: '',
      adminTab: null,
    };
  }

  // 4. Backwards compatibility for legacy ?code=, ?portal=, ?tab= links
  if (normalizedCode) {
    return {
      mode: 'client',
      rolePage: 'home',
      clientTab: 'lookup',
      orderCode: normalizedCode,
      adminTab: null,
    };
  }

  if (portalParam === 'admin') {
    return {
      mode: 'admin',
      rolePage: 'home',
      clientTab: 'lookup',
      orderCode: '',
      adminTab: (tabParam && SLUG_TO_ADMIN_TAB[tabParam]) || null,
    };
  }

  if (portalParam === 'client') {
    const clientTab: ClientPortalTab =
      tabParam === 'order' || tabParam === 'checker' || tabParam === 'lookup'
        ? tabParam
        : 'lookup';
    return {
      mode: 'client',
      rolePage: 'home',
      clientTab,
      orderCode: normalizedCode,
      adminTab: null,
    };
  }

  return {
    mode: 'select',
    rolePage: 'home',
    clientTab: 'lookup',
    orderCode: '',
    adminTab: null,
  };
}

export function buildClientTabPath(tab: ClientPortalTab, orderCode?: string): string {
  if (tab === 'order') return '/dat-bai';
  if (tab === 'checker') return '/check-ai';
  if (orderCode) {
    return `/tra-cuu?code=${encodeURIComponent(orderCode)}`;
  }
  return '/tra-cuu';
}

export function buildAdminTabPath(tab?: AdminTabKey | null): string {
  if (!tab || tab === 'orders') return '/admin';
  return `/admin/${ADMIN_TAB_SLUGS[tab] || 'orders'}`;
}

export function buildPortalUrl(options: {
  mode: PortalMode;
  page?: 'home' | 'samples';
  clientTab?: ClientPortalTab;
  orderCode?: string;
  adminTab?: AdminTabKey | null;
}): string {
  if (options.mode === 'admin') {
    return buildAdminTabPath(options.adminTab);
  }
  if (options.mode === 'client') {
    return buildClientTabPath(options.clientTab || 'lookup', options.orderCode);
  }
  return options.page === 'samples' ? '/samples' : '/';
}

export function getCanonicalClientUrl(tab: ClientPortalTab): string {
  return `${SITE_ORIGIN}${buildClientTabPath(tab)}`;
}
