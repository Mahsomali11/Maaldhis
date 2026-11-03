import { useEffect, useState, useCallback } from 'react';

export interface SystemBranding {
  systemName: string;
  systemLogo: string;
  systemFavicon: string;
}

const DEFAULT_NAME = 'Maaldhis';
const BRANDING_EVENT = 'system-branding-updated';

function getInitialBrandingFromDom(): SystemBranding {
  const fallback: SystemBranding = {
    systemName: DEFAULT_NAME,
    systemLogo: '',
    systemFavicon: '',
  };

  if (typeof document === 'undefined') return fallback;

  try {
    let pageData: any = null;
    const appEl = document.getElementById('app');
    if (appEl && appEl.dataset.page) {
      pageData = JSON.parse(appEl.dataset.page);
    } else {
      const scriptEl = document.querySelector('script[data-page="app"]');
      if (scriptEl && scriptEl.textContent) {
        pageData = JSON.parse(scriptEl.textContent);
      }
    }

    const sb = pageData?.props?.systemBranding;
    if (sb) {
      return {
        systemName: sb.system_name || DEFAULT_NAME,
        systemLogo: sb.system_logo || '',
        systemFavicon: sb.system_favicon || '',
      };
    }
  } catch {
    // Ignore parse errors
  }

  return fallback;
}

let cachedBranding: SystemBranding = getInitialBrandingFromDom();
let hasFetchedFromApi = false;
let fetchPromise: Promise<SystemBranding> | null = null;

export function syncDocumentBranding(branding: SystemBranding = cachedBranding) {
  if (typeof document === 'undefined') return;

  // 1. Update Favicon (<link rel="icon"> & <link rel="shortcut icon">)
  const faviconHref = branding.systemFavicon || '/favicon.ico';
  const iconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');

  if (iconLinks.length > 0) {
    iconLinks.forEach((link) => {
      if (link.getAttribute('href') !== faviconHref) {
        link.setAttribute('href', faviconHref);
      }
    });
  } else {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.id = 'system-favicon';
    link.href = faviconHref;
    document.head.appendChild(link);
  }

  // 2. Update document.title suffix
  const sysName = branding.systemName || DEFAULT_NAME;
  if (document.title) {
    if (document.title.includes(' - ')) {
      const parts = document.title.split(' - ');
      parts[parts.length - 1] = sysName;
      document.title = parts.join(' - ');
    } else {
      document.title = sysName;
    }
  } else {
    document.title = sysName;
  }
}

export function getPlatformName(): string {
  return cachedBranding.systemName || DEFAULT_NAME;
}

export function getSystemBranding(): SystemBranding {
  return { ...cachedBranding };
}

export function updateSystemBrandingCache(updates: Partial<SystemBranding>) {
  cachedBranding = {
    ...cachedBranding,
    ...updates,
    systemName: (updates.systemName !== undefined ? updates.systemName : cachedBranding.systemName) || DEFAULT_NAME,
  };
  hasFetchedFromApi = true;
  syncDocumentBranding(cachedBranding);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: { ...cachedBranding } }));
  }
}

async function fetchBrandingFromApi(force = false): Promise<SystemBranding> {
  if (hasFetchedFromApi && !force) {
    return cachedBranding;
  }
  if (fetchPromise && !force) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/system-branding', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        cachedBranding = {
          systemName: data?.system_name || DEFAULT_NAME,
          systemLogo: data?.system_logo || '',
          systemFavicon: data?.system_favicon || '',
        };
        hasFetchedFromApi = true;
        syncDocumentBranding(cachedBranding);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: { ...cachedBranding } }));
        }
      }
    } catch {
      // Keep existing cachedBranding
    } finally {
      fetchPromise = null;
    }
    return cachedBranding;
  })();

  return fetchPromise;
}

export function clearPlatformNameCache() {
  hasFetchedFromApi = false;
  fetchBrandingFromApi(true);
}

export function useSystemBranding() {
  const [branding, setBranding] = useState<SystemBranding>(() => getSystemBranding());

  useEffect(() => {
    syncDocumentBranding(cachedBranding);
    if (!hasFetchedFromApi) {
      fetchBrandingFromApi().then((latest) => {
        setBranding({ ...latest });
      });
    } else {
      setBranding(getSystemBranding());
    }

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<SystemBranding>;
      if (customEvent.detail) {
        setBranding({ ...customEvent.detail });
      } else {
        setBranding(getSystemBranding());
      }
    };

    window.addEventListener(BRANDING_EVENT, handleUpdate);
    return () => window.removeEventListener(BRANDING_EVENT, handleUpdate);
  }, []);

  const refreshBranding = useCallback(async () => {
    const latest = await fetchBrandingFromApi(true);
    setBranding({ ...latest });
  }, []);

  return {
    ...branding,
    refreshBranding,
  };
}

export function usePlatformName() {
  const { systemName } = useSystemBranding();
  return systemName;
}
