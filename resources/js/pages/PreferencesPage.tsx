import PageHeader from '@/components/PageHeader';
import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { useApp } from '@/context/AppContext';
import { getExchangeRates, type ExchangeRate } from '@/lib/currency';
import { toast } from 'sonner';
import { Monitor } from 'lucide-react';

export default function PreferencesPage() {
  const { currentStore, updateStore } = useApp();
  const [currency, setCurrency] = useState(currentStore?.currency || 'KSh');
  const [taxEnabled, setTaxEnabled] = useState(currentStore?.tax_enabled || false);
  const [taxRate, setTaxRate] = useState((currentStore?.tax_rate || 0).toString());
  const [receiptFooter, setReceiptFooter] = useState(currentStore?.receipt_footer_text || 'Thank you for shopping with us!');
  const [lowStockThreshold, setLowStockThreshold] = useState((currentStore?.low_stock_threshold || 5).toString());
  const [currencies, setCurrencies] = useState<ExchangeRate[]>([]);
  const navigate = (url, options) => router.visit(url, options);

  useEffect(() => {
    getExchangeRates().then(setCurrencies);
  }, []);

  const handleSave = async () => {
    if (currentStore) {
      await updateStore(currentStore.id, {
        currency,
        tax_enabled: taxEnabled,
        tax_rate: parseFloat(taxRate) || 0,
        receipt_footer_text: receiptFooter,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 5
      });
      toast.success('Preferences saved');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Preferences" />
      <div className="px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground">
              {currencies.map(c => (
                <option key={c.currency_code} value={c.currency_symbol}>
                  {c.currency_symbol} — {c.currency_name} ({c.currency_code})
                </option>
              ))}
              {currencies.length === 0 && (
                <>
                  <option value="KSh">KSh (Kenya Shilling)</option>
                  <option value="$">$ (US Dollar)</option>
                  <option value="€">€ (Euro)</option>
                </>
              )}
            </select>
            <p className="text-xs text-muted-foreground mt-1">All store operations use this currency. Platform analytics are converted to USD automatically.</p>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Enable Tax/VAT</label>
            <button onClick={() => setTaxEnabled(!taxEnabled)}
              className={`w-12 h-6 rounded-full transition-colors ${taxEnabled ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`w-5 h-5 rounded-full bg-card shadow transition-transform ${taxEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {taxEnabled && (
            <div>
              <label className="text-sm font-medium text-foreground">Tax Rate (%)</label>
              <input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground" />
              <p className="text-xs text-muted-foreground mt-1">This percentage will be automatically applied to all sales.</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">Default Low Stock Threshold</label>
            <input type="number" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)}
              className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground" />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Receipt Footer Text</label>
            <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)}
              className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground" />
          </div>
        </div>

        <button onClick={handleSave}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform">
          Save Preferences
        </button>

        <button
          onClick={() => navigate('/devices')}
          className="w-full py-4 rounded-xl bg-card border border-border text-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Monitor size={18} />
          Manage Active Devices
        </button>
      </div>
    </div>
  );
}
