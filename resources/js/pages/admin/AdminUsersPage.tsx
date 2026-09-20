import { useEffect, useState } from 'react';
import { api as apiClient } from '@/api';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    // Get all profiles with their store associations
    const { data: profiles } = await apiClient.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: stores } = await apiClient.from('stores').select('id, store_name, owner_user_id');
    const { data: staff } = await apiClient.from('staff_accounts').select('*');

    const enriched = (profiles || []).map((p: any) => {
      const ownedStore = (stores || []).find((s: any) => s.owner_user_id === p.id);
      const staffEntry = (staff || []).find((s: any) => s.email === p.email);
      return { ...p, store_name: ownedStore?.store_name || staffEntry?.store_id || '—', role: ownedStore ? 'Owner' : staffEntry?.role || 'User' };
    });

    setUsers(enriched);
    setLoading(false);
  };

  const filtered = users.filter((u: any) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[hsl(145,63%,42%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Global Users</h1>
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(220,10%,40%)]" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-[hsl(220,20%,14%)] border border-[hsl(220,15%,20%)] text-white text-sm placeholder:text-[hsl(220,10%,40%)] focus:outline-none focus:ring-1 focus:ring-[hsl(145,63%,42%)]" />
      </div>
      <div className="bg-[hsl(220,20%,14%)] rounded-xl border border-[hsl(220,15%,18%)] overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-[hsl(220,15%,18%)]">
            {['Name', 'Email', 'Phone', 'Store', 'Role', 'Joined'].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-medium text-[hsl(220,10%,50%)] uppercase">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((u: any) => (
              <tr key={u.id} className="border-b border-[hsl(220,15%,18%)] last:border-0 hover:bg-[hsl(220,15%,15%)]">
                <td className="py-3 px-4 text-sm text-white">{u.full_name || '—'}</td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)]">{u.email}</td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)]">{u.phone || '—'}</td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)]">{u.store_name}</td>
                <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 capitalize">{u.role}</span></td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)]">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[hsl(220,10%,40%)]">No users found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
