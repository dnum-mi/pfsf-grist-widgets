/**
 * Informations et métadonnées du widget Timeline Grist Native.
 * Ce module gère l'affichage de la version, la détection du mode DEV et l'objet global window.__WIDGET__.
 */

export const WIDGET_NAME = 'Timeline Grist Native';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
export const IS_DEV = import.meta.env.DEV;

export function formatVersion(version = APP_VERSION, isDev = IS_DEV): string {
  const versionStr = version.startsWith('v') || version === 'dev' ? version : `v${version}`;
  return isDev ? `${versionStr} [DEV]` : versionStr;
}

export function initWidgetInfo(): void {
  const versionEl = document.getElementById('widget-version');
  if (versionEl) {
    versionEl.textContent = formatVersion();
  }

  const devBadge = document.getElementById('dev-badge');
  if (devBadge && IS_DEV) {
    devBadge.textContent = APP_VERSION === 'dev' ? '🛠️ DEV' : `🛠️ DEV v${APP_VERSION}`;
    devBadge.title = `Environnement de développement local (port 5177) — version ${APP_VERSION}`;
    devBadge.style.display = 'inline-flex';
  }

  if (IS_DEV) {
    if (!document.title.startsWith('[DEV]')) {
      const displayVer = APP_VERSION === 'dev' ? '' : ` (v${APP_VERSION})`;
      document.title = `[DEV] ${document.title}${displayVer}`;
    }
    console.info(
      `%c[${WIDGET_NAME}] Running in DEVELOPMENT mode — ${APP_VERSION}`,
      'background: #f97316; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;'
    );
  }
}

// Exposer les métadonnées pour inspection ou intégrations externes
(window as any).__WIDGET__ = {
  name: WIDGET_NAME,
  version: APP_VERSION,
  isDev: IS_DEV
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidgetInfo);
} else {
  initWidgetInfo();
}
