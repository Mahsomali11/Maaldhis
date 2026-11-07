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

function isPlatformAdminUser(user: any): boolean {
  if (!user) return false;
  // Store users (Store Admin, Cashier, Inventory Manager) have assigned_store_id and no admin_role.
  // They must NEVER be treated as Platform Super Admins.
  if (user.assigned_store_id && !user.admin_role && user.is_super_admin !== true && user.is_admin !== true) {
    return false;
  }
  if (user.is_super_admin === true || user.is_admin === true) return true;
  if (user.role === 'super_admin' || user.role === 'super_owner' || user.role === 'superadmin') return true;
  if (typeof user.admin_role === 'string' && user.admin_role.trim().length > 0) return true;
  return false;
}

function getInitialAdminFromDom(): { session: Session | null; admin: AdminProfile | null } {
  if (typeof document === 'undefined') return { session: null, admin: null };
  try {
    const appEl = document.getElementById('app');
    const dataPage = appEl?.getAttribute('data-page');
    if (!dataPage) return { session: null, admin: null };
    const parsed = JSON.parse(dataPage);
    const user = parsed?.props?.auth?.user;
    if (isPlatformAdminUser(user)) {
      const roleVal = (user.admin_role || 'super_owner') as 'super_owner' | 'admin' | 'support';
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
        setAdmin(null);
        setLoading(false);
        return;
      }

      const user = sess.user as any;

      // Strictly check if the user is a Platform Super Admin (never true for Store Admin / Cashier)
      if (isPlatformAdminUser(user)) {
        const roleVal = (user.admin_role || 'super_owner') as 'super_owner' | 'admin' | 'support';
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
      if (isPlatformAdminUser(pageAuthUser)) {
        const roleVal = (pageAuthUser.admin_role || 'super_owner') as 'super_owner' | 'admin' | 'support';
        setSession({ access_token: 'session', user: pageAuthUser });
        setAdmin({
          id: pageAuthUser.id,
          email: pageAuthUser.email || '',
          full_name: pageAuthUser.full_name || pageAuthUser.name || '',
          role: roleVal,
          admin_role: roleVal,
        });
        setLoading(false);
      } else {
        setAdmin(null);
        if (window.location.pathname.startsWith('/admin')) {
          loadAdminFromSession();
        }
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
