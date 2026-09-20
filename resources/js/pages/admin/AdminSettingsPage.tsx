import { useEffect, useState } from 'react';
import { api as apiClient } from '@/api';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { clearPlatformNameCache } from '@/hooks/usePlatformName';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState<Record<string, string>>({});

  useEffect(() => {
    apiClient.from('system_settings').select('*').order('setting_key').then(({ data }) => {
      setSettings(data || []);
      setLoading(false);
    });
  }, []);

  const save = async (id: string, key: string) => {
    if (!(key in edited)) return;
    const { error } = await apiClient.from('system_settings').update({ setting_value: edited[key] } as any).eq('id', id);
    if (error) toast.error('Failed to save'); else {
      toast.success(`${key} updated`);
      if (key === 'platform_name') clearPlatformNameCache();
      setSettings(settings.map((s: any) => s.id === id ? { ...s, setting_value: edited[key] } : s));
      const next = { ...edited };
      delete next[key];
      setEdited(next);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[hsl(145,63%,42%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">System Settings</h1>
      <div className="bg-[hsl(220,20%,14%)] rounded-xl border border-[hsl(220,15%,18%)] divide-y divide-[hsl(220,15%,18%)]">
        {settings.map((s: any) => (
          <div key={s.id} className="p-5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{s.setting_key.replace(/_/g, ' ')}</p>
              <p className="text-xs text-[hsl(220,10%,50%)]">{s.description}</p>
            </div>
            <input
              type="text"
              value={s.setting_key in edited ? edited[s.setting_key] : s.setting_value}
              onChange={e => setEdited({ ...edited, [s.setting_key]: e.target.value })}
              className="w-64 px-3 py-2 rounded-lg bg-[hsl(220,20%,18%)] border border-[hsl(220,15%,25%)] text-white text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(145,63%,42%)]"
            />
            {s.setting_key in edited && (
              <button onClick={() => save(s.id, s.setting_key)} className="p-2 rounded-lg bg-[hsl(145,63%,42%)] text-white hover:opacity-90">
                <Save size={16} />
              </button>
            )}
          </div>
        ))}
        {settings.length === 0 && <div className="p-8 text-center text-[hsl(220,10%,40%)]">No settings configured</div>}
      </div>
    </div>
  );
}
