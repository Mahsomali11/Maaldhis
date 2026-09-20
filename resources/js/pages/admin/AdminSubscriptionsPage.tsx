import { useEffect, useState } from 'react';
import { api as apiClient } from '@/api';
import { Search } from 'lucide-react';

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.from('subscriptions').select('*, plans(name), stores(store_name)').order('created_at', { ascending: false }).then(({ data }) => {
      setSubs(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = subs.filter((s: any) => s.stores?.store_name?.toLowerCase().includes(search.toLowerCase()));
  const statusColors: Record<string, string> = { active: 'bg-green-500/20 text-green-400', past_due: 'bg-yellow-500/20 text-yellow-400', cancelled: 'bg-red-500/20 text-red-400', trialing: 'bg-blue-500/20 text-blue-400' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[hsl(145,63%,42%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(220,10%,40%)]" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-[hsl(220,20%,14%)] border border-[hsl(220,15%,20%)] text-white text-sm placeholder:text-[hsl(220,10%,40%)] focus:outline-none focus:ring-1 focus:ring-[hsl(145,63%,42%)]" />
      </div>
      <div className="bg-[hsl(220,20%,14%)] rounded-xl border border-[hsl(220,15%,18%)] overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-[hsl(220,15%,18%)]">
            {['Store', 'Plan', 'Billing', 'Start', 'End', 'Status'].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-medium text-[hsl(220,10%,50%)] uppercase">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((s: any) => (
              <tr key={s.id} className="border-b border-[hsl(220,15%,18%)] last:border-0 hover:bg-[hsl(220,15%,15%)]">
                <td className="py-3 px-4 text-sm text-white">{s.stores?.store_name || '—'}</td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)]">{s.plans?.name || '—'}</td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)] capitalize">{s.billing_cycle}</td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)]">{s.start_date}</td>
                <td className="py-3 px-4 text-sm text-[hsl(220,10%,60%)]">{s.end_date}</td>
                <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[s.status] || ''}`}>{s.status}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[hsl(220,10%,40%)]">No subscriptions yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
