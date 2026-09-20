import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Search, Plus, Minus, ShoppingCart, ScanBarcode, LayoutList, LayoutGrid, Pencil, Monitor } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { toast } from 'sonner';

interface PaymentAccount {
  id: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
}

export default function StartSalePage() {
  const { items, cart, addToCart, removeFromCart, clearCart, completeSale, customers, formatCurrency, currentStore, updateCartPrice } = useApp();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saleType, setSaleType] = useState<'cash' | 'credit' | 'mixed'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState('');
  const navigate = (url, options) => router.visit(url, options);

  useEffect(() => {
    if (!currentStore) return;
    apiClient
      .from('payment_accounts')
      .select('id, account_name, account_type, is_active')
      .eq('store_id', currentStore.id)
      .eq('is_active', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPaymentAccounts(data);
          setPaymentMethod(data[0].account_name);
        }
      });
  }, [currentStore?.id]);

  useEffect(() => {
    const channel = new BroadcastChannel('pos-cart-channel');
    const handleRequest = (e: MessageEvent) => {
      if (e.data.type === 'REQUEST_STATE') {
        channel.postMessage({ type: 'CART_UPDATE', cart, currency: currentStore?.currency || 'KSh', currentStore });
      }
    };
    channel.addEventListener('message', handleRequest);
    channel.postMessage({ type: 'CART_UPDATE', cart, currency: currentStore?.currency || 'KSh', currentStore });

    return () => {
      channel.removeEventListener('message', handleRequest);
      channel.close();
    };
  }, [cart, currentStore]);

  const storeItems = items.filter((i) => i.store_id === currentStore?.id && i.is_active);
  const filtered = storeItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.barcode.includes(search) ||
    i.item_code.toLowerCase().includes(search.toLowerCase())
  );
  const cartSubtotal = cart.reduce((sum, c) => sum + c.line_total, 0);
  const storeTaxRate = currentStore?.tax_enabled ? (currentStore.tax_rate || 0) : 0;
  const taxAmount = cartSubtotal * (storeTaxRate / 100);
  const cartTotal = cartSubtotal + taxAmount;

  const handleBarcodeScan = async (barcode: string) => {
    if (!currentStore) return;

    try {
      // 1. Look it up in the database (ensures we aren't relying just on React state)
      const { data: found, error } = await apiClient
        .from('items')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('barcode', barcode)
        .eq('is_active', true)
        .maybeSingle();

      if (found) {
        // We need to add this DB item to cart. 
        // Note: addToCart expects an Item object. The found object should match the Item interface.
        addToCart(found, 1);
        
        // Use a sound/beep if you want, but for now a toast works
        toast.success(`Added ${found.name} to cart`);
      } else {
        setSearch(barcode);
        toast.error('Item not found for this barcode');
      }
    } catch (err) {
      toast.error('Error scanning barcode');
    }
  };

  useBarcodeScanner({ onScan: handleBarcodeScan });

  const handleComplete = async () => {
    if (isSubmitting) return;
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (saleType !== 'cash' && !selectedCustomer) {
      toast.error('Please select a customer for credit/mixed sales');
      return;
    }
    setIsSubmitting(true);
    try {
      const paid = saleType === 'cash' ? cartTotal : Number(paidAmount) || 0;
      const sale = await completeSale(saleType, selectedCustomer, paid, paymentMethod);
      if (sale) {
        toast.success('Sale completed!');
        navigate('/receipt/' + sale.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPrice = (itemId: string, currentPrice: number) => {
    setEditingPrice(itemId);
    setTempPrice(String(currentPrice));
  };

  const handleSavePrice = (itemId: string) => {
    const newPrice = Number(tempPrice);
    if (newPrice > 0) {
      updateCartPrice(itemId, newPrice);
      toast.success('Price updated');
    }
    setEditingPrice(null);
    setTempPrice('');
  };

  if (showScanner) {
    return <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />;
  }

  if (showCheckout) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PageHeader title="Checkout" />
        <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
          <div className="bg-card rounded-xl p-4">
            <h3 className="font-bold text-foreground mb-3">Order Summary</h3>
            {cart.map((c) => (
              <div key={c.item.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <span className="text-foreground">{c.item.name} x{c.quantity}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editingPrice === c.item.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={tempPrice}
                        onChange={e => setTempPrice(e.target.value)}
                        className="w-20 px-2 py-1 rounded border border-input bg-accent/30 text-foreground text-sm"
                        onKeyDown={e => e.key === 'Enter' && handleSavePrice(c.item.id)}
                        autoFocus
                      />
                      <button onClick={() => handleSavePrice(c.item.id)} className="text-xs text-primary font-bold">OK</button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-primary">{formatCurrency(c.line_total)}</span>
                      <button onClick={() => handleEditPrice(c.item.id, c.item.sell_price)} className="p-1">
                        <Pencil size={14} className="text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {storeTaxRate > 0 ? (
              <div className="pt-3 mt-2 border-t border-dashed border-border space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Tax ({storeTaxRate}%)</span>
                  <span className="text-foreground">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 mt-1 border-t border-border font-bold text-lg">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between pt-3 mt-2 border-t border-dashed border-border font-bold text-lg">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{formatCurrency(cartTotal)}</span>
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl p-4">
            <h3 className="font-bold text-foreground mb-3">Sale Type</h3>
            <div className="flex gap-2">
              {(['cash', 'credit', 'mixed'] as const).map((type) => (
                <button key={type} onClick={() => setSaleType(type)}
                  className={`flex-1 py-3 rounded-lg font-medium capitalize ${saleType === type ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          {saleType !== 'cash' && (
            <div className="bg-card rounded-xl p-4">
              <h3 className="font-bold text-foreground mb-3">Select Customer</h3>
              <select value={selectedCustomer || ''} onChange={(e) => setSelectedCustomer(e.target.value || null)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground">
                <option value="">Select customer...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Amount paid now"
                className="w-full mt-3 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
            </div>
          )}

          <div className="bg-card rounded-xl p-4">
            <h3 className="font-bold text-foreground mb-3">Payment Method</h3>
            <div className="flex flex-wrap gap-2">
              {paymentAccounts.length > 0 ? (
                paymentAccounts.map((acc) => (
                  <button key={acc.id} onClick={() => setPaymentMethod(acc.account_name)}
                    className={`flex-1 min-w-[80px] py-3 rounded-lg font-medium text-sm ${paymentMethod === acc.account_name ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground'}`}>
                    {acc.account_name}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No payment accounts configured. Go to Payment Accounts settings to add them.</p>
              )}
            </div>
          </div>

          <button onClick={handleComplete} disabled={isSubmitting}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50">
            {isSubmitting ? 'Processing...' : 'Complete Sale'}
          </button>
          <button onClick={() => setShowCheckout(false)}
            className="w-full py-3 rounded-xl bg-accent text-foreground font-medium">
            Back to Items
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-32">
      <div className="flex items-center justify-between border-b border-border bg-card">
        <PageHeader title="Start Sale" />
        <button 
          onClick={() => window.open('/customer-display', 'CustomerDisplay', 'width=1024,height=768')}
          className="mr-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-2 transition-colors">
          <Monitor size={16} />
          Customer Display
        </button>
      </div>
      
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items or barcode..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          </div>
          <button onClick={() => setShowScanner(true)}
            className="px-4 py-3 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
            <ScanBarcode size={22} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">{filtered.length} items</p>
          <div className="flex bg-card rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
              <LayoutList size={18} />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No items found.</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or scan a barcode.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filtered.map((item) => {
              const inCart = cart.find((c) => c.item.id === item.id);
              const isLowStock = item.type === 'product' && item.quantity <= item.low_stock_threshold;
              return (
                <div key={item.id} className="bg-card rounded-xl p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">{item.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.type === 'product' && (
                        <span className={`text-xs font-medium ${isLowStock ? 'text-destructive' : 'text-success'}`}>
                          Qty: {item.quantity}
                        </span>
                      )}
                      {item.type === 'service' && <span className="text-xs font-medium text-info">Service</span>}
                      <span className="text-sm text-primary font-medium">
                        {item.sell_price > 0 ? formatCurrency(item.sell_price) : 'No price'}
                      </span>
                    </div>
                    {item.barcode && <p className="text-xs text-muted-foreground mt-0.5">{item.barcode}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {inCart && (
                      <>
                        <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                          <Minus size={16} className="text-destructive" />
                        </button>
                        <span className="w-8 text-center font-bold text-foreground">{inCart.quantity}</span>
                      </>
                    )}
                    <button onClick={() => addToCart(item, 1)}
                      disabled={item.type === 'product' && item.quantity <= (inCart?.quantity || 0)}
                      className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center disabled:opacity-30">
                      <Plus size={16} className="text-primary" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((item) => {
              const inCart = cart.find((c) => c.item.id === item.id);
              const isLowStock = item.type === 'product' && item.quantity <= item.low_stock_threshold;
              const isOutOfStock = item.type === 'product' && item.quantity === 0;
              return (
                <div key={item.id}
                  className={`relative bg-card rounded-2xl p-4 flex flex-col border transition-all ${
                    inCart ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                  }`}>
                  {inCart && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md">
                      {inCart.quantity}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 mb-3">
                    <h4 className="font-bold text-foreground text-sm truncate">{item.name}</h4>
                    <p className="text-lg font-extrabold text-primary mt-1">
                      {item.sell_price > 0 ? formatCurrency(item.sell_price) : 'No price'}
                    </p>
                    {item.type === 'product' && (
                      <p className={`text-xs font-semibold mt-1 ${
                        isOutOfStock ? 'text-destructive' : isLowStock ? 'text-warning' : 'text-muted-foreground'
                      }`}>
                        {isOutOfStock ? 'Out of Stock' : `Qty: ${item.quantity}`}
                      </p>
                    )}
                    {item.type === 'service' && <p className="text-xs font-medium text-info mt-1">Service</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {inCart && (
                      <button onClick={() => removeFromCart(item.id)}
                        className="flex-1 py-2 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Minus size={16} className="text-destructive" />
                      </button>
                    )}
                    <button onClick={() => addToCart(item, 1)}
                      disabled={item.type === 'product' && item.quantity <= (inCart?.quantity || 0)}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1 font-semibold text-sm disabled:opacity-30 transition-colors ${
                        inCart ? 'bg-primary/10 text-primary' : 'bg-primary text-primary-foreground'
                      }`}>
                      <Plus size={14} />
                      {inCart ? '' : 'Add'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="sticky bottom-0 bg-card border-t border-border p-4 safe-bottom rounded-none py-[31px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-primary" />
              <span className="font-bold text-foreground">{cart.reduce((s, c) => s + c.quantity, 0)} items</span>
            </div>
            <span className="font-bold text-lg text-primary">{formatCurrency(cartTotal)}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={clearCart} className="flex-1 py-3 rounded-xl bg-destructive/10 text-destructive font-medium">
              Clear
            </button>
            <button onClick={() => setShowCheckout(true)} className="flex-[2] py-3 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform">
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
