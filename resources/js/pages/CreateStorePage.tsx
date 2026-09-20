import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import { getExchangeRates, type ExchangeRate } from '@/lib/currency';

export default function CreateStorePage() {
  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [country, setCountry] = useState('');
  const [currencies, setCurrencies] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const { addStore, user } = useApp();
  const navigate = (url, options) => router.visit(url, options);

  useEffect(() => {
    getExchangeRates().then(setCurrencies);
  }, []);

  // Check store creation limits on mount
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await apiClient.rpc('check_store_creation_allowed', {
        _user_id: user.id,
      });
      if (!error && data && typeof data === 'object') {
        const result = data as any;
        if (!result.allowed) {
          setBlocked(result.reason);
        }
      }
    })();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) { toast.error('You must be logged in to create a store'); return; }

    // Double-check server-side before creating
    const { data: check } = await apiClient.rpc('check_store_creation_allowed', { _user_id: user.id });
    const checkResult = check as any;
    if (checkResult && !checkResult.allowed) {
      toast.error(checkResult.reason);
      setBlocked(checkResult.reason);
      return;
    }

    setLoading(true);
    try {
      const selectedCurrency = currencies.find(c => c.currency_code === currency);
      const store = {
        owner_user_id: user.id,
        store_name: storeName,
        store_code: String(Math.floor(10000 + Math.random() * 90000)),
        location,
        phone,
        currency: selectedCurrency?.currency_symbol || currency,
        country,
      };
      const newStore = await addStore(store as any);
      if (newStore) {
        toast.success('Store created successfully!');
        navigate('/dashboard');
      } else {
        toast.error('Failed to create store. Please try again.');
      }
    } catch (error: any) {
      console.error('Store creation error:', error);
      toast.error(error?.message || 'An error occurred while creating the store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader title="Create Your Store" showBack={false} />
      <div className="flex-1 bg-card rounded-t-2xl px-6 py-8">
        {blocked ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <span className="text-2xl">🚫</span>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Store Creation Blocked</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{blocked}</p>
            <button
              onClick={() => navigate('/upgrade')}
              className="mt-6 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold"
            >
              Upgrade Plan
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground mb-6">Set up your business</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Store name"
                className="w-full px-4 py-4 rounded-lg border-2 border-input bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" required disabled={loading} />
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location / City"
                className="w-full px-4 py-4 rounded-lg border-2 border-input bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" required disabled={loading} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Business phone number"
                className="w-full px-4 py-4 rounded-lg border-2 border-input bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" required disabled={loading} />
              <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country"
                className="w-full px-4 py-4 rounded-lg border-2 border-input bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" disabled={loading} />
              
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Store Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full px-4 py-4 rounded-lg border-2 border-input bg-accent/30 text-foreground focus:outline-none focus:border-primary" disabled={loading}>
                  {currencies.map(c => (
                    <option key={c.currency_code} value={c.currency_code}>
                      {c.currency_symbol} — {c.currency_name} ({c.currency_code})
                    </option>
                  ))}
                  {currencies.length === 0 && <option value="KES">KSh — Kenya Shilling</option>}
                </select>
                <p className="text-xs text-muted-foreground mt-1">All store operations (sales, expenses, reports) will use this currency.</p>
              </div>

              <button type="submit" disabled={loading} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg mt-2 active:scale-[0.98] transition-transform disabled:opacity-50">
                {loading ? 'Creating...' : 'Create Store'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
