import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { api as apiClient } from '@/api';
import type { Session } from '@/api';

interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'super_owner' | 'admin' | 'support';
  admin_role: string;
}

interface AdminContextType {
  session: Session | null;
  admin: AdminProfile | null;
  isAdminAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  isSuperOwner: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

function getInitialAdminFromDom(): { session: Session | null; admin: AdminProfile | null } {
  if (typeof document === 'undefined') return { session: null, admin: null };
  try {
    const appEl = document.getElementById('app');
    const dataPage = appEl?.getAttribute('data-page');
    if (!dataPage) return { session: null, admin: null };
    const parsed = JSON.parse(dataPage);
    const user = parsed?.props?.auth?.user;
    if (user && (user.role === 'admin' || user.admin_role)) {
      const roleVal = (user.admin_role || 'admin') as 'super_owner' | 'admin' | 'support';
      return {
        session: { access_token: 'session', user },
        admin: {
          id: user.id,
          email: user.email || '',
          full_name: user.full_name || user.name || '',
          role: roleVal,
          admin_role: roleVal,
        },
      };
    }
  } catch {}
  return { session: null, admin: null };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const initial = getInitialAdminFromDom();
  const [session, setSession] = useState<Session | null>(initial.session);
  const [admin, setAdmin] = useState<AdminProfile | null>(initial.admin);
  const [loading, setLoading] = useState(!initial.admin);

  const loadAdminFromSession = useCallback(async () => {
    try {
      const { data: { session: sess } } = await apiClient.auth.getSession();
      if (!sess?.user) {
        setLoading(false);
        return;
      }

      const user = sess.user as any;

      // Check if the user has admin role in the API response
      if (user.role === 'admin' || user.admin_role) {
        const roleVal = (user.admin_role || 'admin') as 'super_owner' | 'admin' | 'support';
        setSession(sess);
        setAdmin({
          id: user.id,
          email: user.email || '',
          full_name: user.full_name || user.name || '',
          role: roleVal,
          admin_role: roleVal,
        });
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) {
      loadAdminFromSession();
    } else {
      setLoading(false);
    }

    const removeListener = router.on('navigate', (event) => {
      const pageAuthUser = (event.detail.page?.props as any)?.auth?.user;
      if (pageAuthUser && (pageAuthUser.role === 'admin' || pageAuthUser.admin_role)) {
        const roleVal = (pageAuthUser.admin_role || 'admin') as 'super_owner' | 'admin' | 'support';
        setSession({ access_token: 'session', user: pageAuthUser });
        setAdmin({
          id: pageAuthUser.id,
          email: pageAuthUser.email || '',
          full_name: pageAuthUser.full_name || pageAuthUser.name || '',
          role: roleVal,
          admin_role: roleVal,
        });
        setLoading(false);
      } else if (window.location.pathname.startsWith('/admin')) {
        loadAdminFromSession();
      }
    });

    return () => removeListener();
  }, [loadAdminFromSession]);

  const logout = useCallback(async () => {
    try {
      const csrf = document.cookie
        .split(';')
        .find(c => c.trim().startsWith('XSRF-TOKEN='))
        ?.split('=')[1] || '';

      await fetch('/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': decodeURIComponent(csrf),
          'Accept': 'application/json',
        },
      });
    } catch (_) {}

    setSession(null);
    setAdmin(null);
    window.location.href = '/admin/login';
  }, []);

  const isSuperOwner = ['super_owner', 'superadmin', 'super_admin'].includes(
    String(admin?.role || admin?.admin_role || '').toLowerCase()
  );

  return (
    <AdminContext.Provider value={{
      session,
      admin,
      isAdminAuthenticated: !!admin,
      loading,
      logout,
      isSuperOwner,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
