import PageHeader from '@/components/PageHeader';
import { useEffect, useState, useRef } from 'react';
import { api as apiClient } from '@/api';
import { toast } from 'sonner';
import { Save, Upload, X, Globe, Image as ImageIcon, Type, Store, Loader2 } from 'lucide-react';
import {
  clearPlatformNameCache,
  updateSystemBrandingCache,
  useSystemBranding,
} from '@/hooks/usePlatformName';

const BRANDING_KEYS = [
  'platform_name',
  'system_name',
  'system_logo',
  'platform_logo',
  'system_favicon',
  'platform_favicon',
];

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('XSRF-TOKEN='))
    ?.split('=')[1];
  return match ? decodeURIComponent(match) : '';
}

export default function AdminSettingsPage() {
  const { systemName: initialName, systemLogo: initialLogo, systemFavicon: initialFavicon } = useSystemBranding();

  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState<Record<string, string>>({});

  // Branding state
  const [systemName, setSystemName] = useState(initialName || 'Maaldhis');
  const [systemLogo, setSystemLogo] = useState(initialLogo || '');
  const [systemFavicon, setSystemFavicon] = useState(initialFavicon || '');

  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await apiClient.from('system_settings').select('*').order('setting_key');
    const rows = data || [];
    setSettings(rows);

    const byKey: Record<string, string> = {};
    rows.forEach((r: any) => {
      if (r.setting_key) {
        byKey[r.setting_key] = r.setting_value ?? '';
      }
    });

    const loadedName = byKey.system_name || byKey.platform_name || initialName || 'Maaldhis';
    const loadedLogo = byKey.system_logo || byKey.platform_logo || initialLogo || '';
    const loadedFavicon = byKey.system_favicon || byKey.platform_favicon || initialFavicon || '';

    setSystemName(loadedName);
    setSystemLogo(loadedLogo);
    setSystemFavicon(loadedFavicon);

    updateSystemBrandingCache({
      systemName: loadedName,
      systemLogo: loadedLogo,
      systemFavicon: loadedFavicon,
    });

    setLoading(false);
  };

  const upsertSetting = async (key: string, value: string, description: string) => {
    const existing = settings.find((s: any) => s.setting_key === key);
    if (existing?.id) {
      const { error } = await apiClient
        .from('system_settings')
        .update({ setting_value: value, description } as any)
        .eq('id', existing.id);
      if (error) throw error;
      setSettings((prev) =>
        prev.map((s: any) => (s.id === existing.id ? { ...s, setting_value: value, description } : s))
      );
    } else {
      const { data, error } = await apiClient
        .from('system_settings')
        .insert({ setting_key: key, setting_value: value, description } as any);
      if (error) throw error;
      const inserted = Array.isArray(data) ? data[0] : data;
      if (inserted) {
        setSettings((prev) => {
          const exists = prev.some((s: any) => s.setting_key === key);
          if (exists) {
            return prev.map((s: any) => (s.setting_key === key ? inserted : s));
          }
          return [...prev, inserted];
        });
      }
    }
  };

  const handleSaveBranding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = systemName.trim();
    if (!trimmedName) {
      toast.error('System name cannot be empty.');
      return;
    }

    setSavingBranding(true);
    try {
      await upsertSetting('platform_name', trimmedName, 'Official platform/system name');
      await upsertSetting('system_name', trimmedName, 'Official system name displayed across layout, headers, and sidebar');
      await upsertSetting('system_logo', systemLogo, 'System logo URL displayed on sidebar and headers');
      await upsertSetting('system_favicon', systemFavicon, 'Web icon / favicon URL displayed in browser tabs');

      updateSystemBrandingCache({
        systemName: trimmedName,
        systemLogo,
        systemFavicon,
      });

      toast.success('System branding settings saved successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save branding settings');
    } finally {
      setSavingBranding(false);
    }
  };

  const uploadBrandingFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', 'system-branding');

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-XSRF-TOKEN': getCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      let errMsg = 'Failed to upload image';
      try {
        const errData = await response.json();
        errMsg = errData.message || errData.error || errMsg;
      } catch {
        // Ignore parse error
      }
      throw new Error(errMsg);
    }

    const { url } = await response.json();
    return url;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
    if (!allowedExts.includes(ext)) {
      toast.error('Only PNG, JPG, JPEG, WEBP, or SVG files are allowed for the System Logo.');
      return;
    }

    if (file.size > 350000) {
      toast.error('Image size must not exceed 350KB.');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setUploadingLogo(true);
    try {
      const url = await uploadBrandingFile(file);
      setSystemLogo(url);
      await upsertSetting('system_logo', url, 'System logo URL displayed on sidebar and headers');
      updateSystemBrandingCache({ systemLogo: url });
      toast.success('System logo uploaded and applied');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload system logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      setSystemLogo('');
      await upsertSetting('system_logo', '', 'System logo URL displayed on sidebar and headers');
      updateSystemBrandingCache({ systemLogo: '' });
      toast.success('System logo removed');
    } catch {
      toast.error('Failed to remove system logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['ico', 'png', 'svg', 'jpg', 'jpeg', 'webp'];
    if (!allowedExts.includes(ext)) {
      toast.error('Only ICO, PNG, SVG, JPG, or WEBP files are allowed for the Favicon.');
      return;
    }

    if (file.size > 350000) {
      toast.error('Image size must not exceed 350KB.');
      if (faviconInputRef.current) faviconInputRef.current.value = '';
      return;
    }

    setUploadingFavicon(true);
    try {
      const url = await uploadBrandingFile(file);
      setSystemFavicon(url);
      await upsertSetting('system_favicon', url, 'Web icon / favicon URL displayed in browser tabs');
      updateSystemBrandingCache({ systemFavicon: url });
      toast.success('Web Icon (Favicon) uploaded and applied');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload favicon');
    } finally {
      setUploadingFavicon(false);
      if (faviconInputRef.current) faviconInputRef.current.value = '';
    }
  };

  const handleRemoveFavicon = async () => {
    setUploadingFavicon(true);
    try {
      setSystemFavicon('');
      await upsertSetting('system_favicon', '', 'Web icon / favicon URL displayed in browser tabs');
      updateSystemBrandingCache({ systemFavicon: '' });
      toast.success('Favicon reset to default');
    } catch {
      toast.error('Failed to reset favicon');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const saveOtherSetting = async (id: string, key: string) => {
    if (!(key in edited)) return;
    const { error } = await apiClient
      .from('system_settings')
      .update({ setting_value: edited[key] } as any)
      .eq('id', id);
    if (error) {
      toast.error('Failed to save');
    } else {
      toast.success(`${key} updated`);
      if (key === 'platform_name' || key === 'system_name') clearPlatformNameCache();
      setSettings(settings.map((s: any) => (s.id === id ? { ...s, setting_value: edited[key] } : s)));
      const next = { ...edited };
      delete next[key];
      setEdited(next);
    }
  };

  const otherSettings = settings.filter((s: any) => !BRANDING_KEYS.includes(s.setting_key));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:px-8 space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="System Settings"
        rightAction={
          <button
            type="button"
            onClick={() => handleSaveBranding()}
            disabled={savingBranding}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {savingBranding ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{savingBranding ? 'Saving...' : 'Save Branding'}</span>
          </button>
        }
      />

      {/* System Branding Card */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border bg-muted/20">
          <h2 className="text-lg font-bold text-foreground">System Branding</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the official system name, logo, and browser tab icon (favicon) displayed across all pages.
          </p>
        </div>

        <div className="divide-y divide-border">
          {/* 1. System Name */}
          <form onSubmit={handleSaveBranding} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <Type size={16} className="text-primary" />
                <label htmlFor="system-name-input" className="text-sm font-bold text-foreground">
                  System Name
                </label>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The official name of your platform. Updates dynamically across the application layout, headers, sidebar, and page titles.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <input
                id="system-name-input"
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder="e.g. Maaldhis"
                className="flex-1 lg:w-72 px-4 py-2.5 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="submit"
                disabled={savingBranding}
                className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                <Save size={16} />
                <span>Save</span>
              </button>
            </div>
          </form>

          {/* 2. System Logo */}
          <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-primary" />
                <label className="text-sm font-bold text-foreground">System Logo</label>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Displayed in the main sidebar, mobile header, and authentication screens. Recommended: square or compact logo (PNG, JPG, SVG, or WEBP, max 350KB).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Preview */}
              <div className="w-20 h-20 rounded-2xl bg-background border border-border flex items-center justify-center overflow-hidden relative shrink-0 shadow-sm">
                {systemLogo ? (
                  <img src={systemLogo} alt={systemName} className="w-full h-full object-contain p-1.5" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <Store size={22} className="text-primary-foreground" />
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    <Upload size={16} />
                    <span>{systemLogo ? 'Change Logo' : 'Upload Logo'}</span>
                  </button>
                  {systemLogo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      <X size={16} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  PNG, JPG, SVG, WEBP · Max 350KB
                </span>
              </div>
            </div>
          </div>

          {/* 3. Web Icon (Favicon) */}
          <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                <label className="text-sm font-bold text-foreground">Web Icon (Favicon)</label>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Browser tab icon and bookmark icon rendered across all pages. Recommended: 32×32px or 64×64px (ICO, PNG, or SVG, max 350KB).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Favicon + Browser Tab Preview */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center overflow-hidden relative shrink-0 shadow-sm">
                  {systemFavicon ? (
                    <img src={systemFavicon} alt="Favicon" className="w-9 h-9 object-contain" />
                  ) : (
                    <Globe size={24} className="text-muted-foreground" />
                  )}
                  {uploadingFavicon && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <Loader2 size={18} className="animate-spin text-primary" />
                    </div>
                  )}
                </div>

                {/* Live Browser Tab Mock */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-t-lg bg-muted/60 border border-border max-w-[180px] shadow-inner">
                  {systemFavicon ? (
                    <img src={systemFavicon} alt="" className="w-4 h-4 object-contain shrink-0" />
                  ) : (
                    <Globe size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-medium text-foreground truncate">
                    {systemName || 'Maaldhis'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/jpeg,image/webp,.ico"
                  onChange={handleFaviconUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploadingFavicon}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    <Upload size={16} />
                    <span>{systemFavicon ? 'Change Favicon' : 'Upload Favicon'}</span>
                  </button>
                  {systemFavicon && (
                    <button
                      type="button"
                      onClick={handleRemoveFavicon}
                      disabled={uploadingFavicon}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      <X size={16} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  ICO, PNG, SVG, WEBP · Max 350KB
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional System Parameters (if any non-branding settings exist) */}
      {otherSettings.length > 0 && (
        <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden shadow-sm">
          <div className="p-5 bg-muted/20">
            <h3 className="text-sm font-bold text-foreground">Additional System Parameters</h3>
          </div>
          {otherSettings.map((s: any) => (
            <div key={s.id} className="p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.setting_key.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              <input
                type="text"
                value={s.setting_key in edited ? edited[s.setting_key] : s.setting_value}
                onChange={(e) => setEdited({ ...edited, [s.setting_key]: e.target.value })}
                className="w-64 px-3 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {s.setting_key in edited && (
                <button
                  onClick={() => saveOtherSetting(s.id, s.setting_key)}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Save size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
