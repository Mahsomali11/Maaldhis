import { useState } from 'react';
import { router } from '@inertiajs/react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import StoreLogoUpload from '@/components/StoreLogoUpload';
import { toast } from 'sonner';

export default function StoreEditPage() {
  const { currentStore, updateStore } = useApp();
  const navigate = (url, options) => router.visit(url, options);
  const [name, setName] = useState(currentStore?.store_name || '');
  const [location, setLocation] = useState(currentStore?.location || '');
  const [phone, setPhone] = useState(currentStore?.phone || '');
  const [logoUrl, setLogoUrl] = useState(currentStore?.logo_url || '');
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(currentStore?.show_logo_on_receipt ?? true);
  const [thankYouMessage, setThankYouMessage] = useState(currentStore?.receipt_thank_you_message || 'Thank you for your purchase!');
  const [receiptFooter, setReceiptFooter] = useState(currentStore?.receipt_footer_text || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStore) {
      await updateStore(currentStore.id, {
        store_name: name,
        location,
        phone,
        logo_url: logoUrl,
        show_logo_on_receipt: showLogoOnReceipt,
        receipt_thank_you_message: thankYouMessage,
        receipt_footer_text: receiptFooter,
      });
      toast.success('Store settings saved');
      navigate(-1);
    }
  };

  if (!currentStore) return null;

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <PageHeader title="Store Settings" />
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto space-y-5">
        <form onSubmit={handleSave} className="space-y-5">

          {/* Store Logo */}
          <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Store Logo</h3>
            <StoreLogoUpload
              storeId={currentStore.id}
              currentLogoUrl={logoUrl}
              storeName={currentStore.store_name}
              onLogoUploaded={setLogoUrl}
              size="lg"
            />
          </div>

          {/* Store Information */}
          <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Store Information</h3>
            <div>
              <label className="text-sm font-medium text-foreground">Store Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground" required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground" required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground" required />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Store ID</label>
              <p className="text-foreground font-mono mt-1">{currentStore.store_code}</p>
            </div>
          </div>

          {/* Receipt Branding */}
          <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Receipt Branding</h3>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Show Logo on Receipt</label>
              <button type="button" onClick={() => setShowLogoOnReceipt(!showLogoOnReceipt)}
                className={`w-12 h-6 rounded-full transition-colors ${showLogoOnReceipt ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`w-5 h-5 rounded-full bg-card shadow transition-transform ${showLogoOnReceipt ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Thank You Message</label>
              <input value={thankYouMessage} onChange={e => setThankYouMessage(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground"
                placeholder="Thank you for your purchase!" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Custom Receipt Footer</label>
              <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground"
                placeholder="Optional custom footer text" />
              <p className="text-xs text-muted-foreground mt-1">"Powered by Nasri Point" will always appear on receipts.</p>
            </div>
          </div>

          <button type="submit" className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
