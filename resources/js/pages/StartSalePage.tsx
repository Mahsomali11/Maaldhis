import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Search, Plus, Minus, ShoppingCart, ScanBarcode, LayoutGrid, Pencil, Monitor, ArrowLeft, X, Tag } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
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
  const { items, cart, addToCart, removeFromCart, clearCart, completeSale, customers, formatCurrency, currentStore, updateCartPrice, categories: allCategories } = useApp();
  const [search, setSearch] = useState('');
  const [showCheckoutMobile, setShowCheckoutMobile] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(null);
  const [saleType, setSaleType] = useState<'cash' | 'credit' | 'mixed'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState('');
  
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  
  const storeCategories = allCategories ? allCategories.filter(c => c.store_id === currentStore?.id) : [];

  const navigate = (url: string, options?: any) => router.visit(url, options);

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
          setPaymentAccountId(data[0].id);
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

  const storeItems = items.filter((i) => 
    i.store_id === currentStore?.id && 
    i.is_active && 
    (i.is_service || i.quantity > 0)
  );

  const categoryHasItems = (categoryId: string, categoryName: string, isSub: boolean = false) => {
    if (isSub) {
      return storeItems.some(i => i.sub_category_id === categoryId);
    }
    return storeItems.some(i => i.category === categoryName);
  };

  const topLevelCategories = storeCategories.filter(c => !c.parent_id && categoryHasItems(c.id, c.name, false));

  const currentLevelCategories = activeParentId 
    ? storeCategories.filter(c => c.parent_id === activeParentId && categoryHasItems(c.id, c.name, true))
    : topLevelCategories;

  const filtered = storeItems.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
                          i.barcode?.includes(search) ||
                          i.item_code?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (activeParentId) {
       const parentCat = storeCategories.find(c => c.id === activeParentId);
       if (activeCategory === 'All') {
          return i.category === parentCat?.name;
       } else {
          return i.sub_category_id === activeCategory;
       }
    } else {
       if (activeCategory === 'All') return true;
       return i.category === activeCategory;
    }
  });

  const handleCategoryClick = (cat: any) => {
    if (cat === 'All') {
      setActiveCategory('All');
      setActiveParentId(null);
      return;
    }
    if (cat === 'Back') {
      setActiveCategory('All');
      setActiveParentId(null);
      return;
    }
    
    if (!activeParentId) {
      const subs = storeCategories.filter(c => c.parent_id === cat.id && categoryHasItems(c.id, c.name, true));
      if (subs.length > 0) {
        setActiveParentId(cat.id);
        setActiveCategory('All');
      } else {
        setActiveCategory(cat.name);
      }
    } else {
      setActiveCategory(cat.id);
    }
  };
  
  const cartSubtotal = cart.reduce((sum, c) => sum + c.line_total, 0);
  const storeTaxRate = currentStore?.tax_enabled ? (currentStore.tax_rate || 0) : 0;
  const taxAmount = cartSubtotal * (storeTaxRate / 100);
  const cartTotal = cartSubtotal + taxAmount;

  const handleBarcodeScan = async (barcode: string) => {
    if (!currentStore) return;
    try {
      const { data: found } = await apiClient
        .from('items')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('barcode', barcode)
        .eq('is_active', true)
        .maybeSingle();

      if (found) {
        if (found.is_service || found.quantity > 0) {
          addToCart(found, 1);
          toast.success(`Added ${found.name}`);
        } else {
          setSearch(barcode);
          toast.error('Item is out of stock');
        }
      } else {
        setSearch(barcode);
        toast.error('Item not found');
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
      toast.error('Please select a customer');
      return;
    }
    setIsSubmitting(true);
    try {
      const paid = saleType === 'cash' ? cartTotal : Number(paidAmount) || 0;
      const sale = await completeSale(saleType, selectedCustomer, paid, paymentAccountId);
      if (sale) {
        toast.success('Sale completed!');
        navigate('/receipt/' + sale.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale.');
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
    const cartItem = cart.find(c => c.item.id === itemId);
    
    if (cartItem && newPrice < Number(cartItem.item.cost_price)) {
      toast.error(`Selling price cannot be less than the item cost price of ${formatCurrency(cartItem.item.cost_price)}`);
      return;
    }

    if (newPrice > 0) {
      updateCartPrice(itemId, newPrice);
    }
    setEditingPrice(null);
    setTempPrice('');
  };

  if (showScanner) {
    return <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />;
  }

  const CheckoutPanel = () => (
    <div className="bg-card h-full flex flex-col rounded-3xl shadow-sm border border-border overflow-hidden lg:shadow-xl">
      <div className="px-6 py-5 border-b border-border/50 bg-muted/10 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
          Current Order
        </h2>
        <span className="bg-primary text-primary-foreground font-bold px-3 py-1 rounded-full text-xs">
          {cart.reduce((s, c) => s + c.quantity, 0)} Items
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <ShoppingCart size={32} className="opacity-50" />
            </div>
            <p className="text-lg font-black text-foreground mb-1">Cart is empty</p>
            <p className="text-sm font-medium text-muted-foreground max-w-xs text-center">Scan a barcode or tap a product to add it to the order.</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {cart.map((c) => (
              <div key={c.item.id} className="bg-background rounded-2xl border border-border p-4 shadow-sm hover:border-primary/50 transition-all group">
                <div className="flex justify-between items-start mb-3 gap-2">
                   <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground text-sm line-clamp-1">{c.item.name}</span>
                      <span className="text-xs font-medium text-muted-foreground mt-0.5">{formatCurrency(c.item.sell_price)} / unit</span>
                   </div>
                   
                   <div className="text-right shrink-0">
                     {editingPrice === c.item.id ? (
                        <div className="flex items-center gap-1">
                           <input
                             type="number"
                             value={tempPrice}
                             onChange={e => setTempPrice(e.target.value)}
                             className="w-20 px-2 py-1 h-7 rounded-lg border border-input bg-background text-foreground text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                             onKeyDown={e => e.key === 'Enter' && handleSavePrice(c.item.id)}
                             autoFocus
                           />
                           <button onClick={() => handleSavePrice(c.item.id)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                              <X size={12} className="rotate-45" />
                           </button>
                        </div>
                     ) : (
                        <div className="flex flex-col items-end gap-1">
                           <span className="font-black text-primary text-base">{formatCurrency(c.line_total)}</span>
                           <button onClick={() => handleEditPrice(c.item.id, c.item.sell_price)} className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100">
                             <Pencil size={10} /> Edit Price
                           </button>
                        </div>
                     )}
                   </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-3">
                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quantity</span>
                   <div className="flex items-center bg-muted rounded-xl p-1">
                      <button onClick={() => removeFromCart(c.item.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground hover:bg-background hover:shadow-sm transition-all">
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-sm w-10 text-center">{c.quantity}</span>
                      <button onClick={() => addToCart(c.item, 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground hover:bg-background hover:shadow-sm transition-all">
                        <Plus size={14} />
                      </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-muted/10 p-6 border-t border-border/50 sticky bottom-0 z-10 backdrop-blur-md">
        {cart.length > 0 && (
          <div className="mb-5 space-y-4">
             <div className="flex gap-2 bg-muted/50 p-1.5 rounded-xl border border-border/50">
               {(['cash', 'credit', 'mixed'] as const).map((type) => (
                 <button 
                  key={type} 
                  onClick={() => setSaleType(type)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${saleType === type ? 'bg-background shadow-sm text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}>
                   {type}
                 </button>
               ))}
             </div>
             {saleType !== 'cash' && (
                <div className="relative">
                   <select value={selectedCustomer || ''} onChange={(e) => setSelectedCustomer(e.target.value || null)}
                     className="w-full px-4 py-3 h-12 rounded-xl border border-input text-sm font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm appearance-none">
                     <option value="">Select customer for credit...</option>
                     {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
             )}
             {saleType !== 'credit' && paymentAccounts.length > 0 && (
                <div className="relative mt-3">
                   <select value={paymentAccountId || ''} onChange={(e) => setPaymentAccountId(e.target.value)}
                     className="w-full px-4 py-3 h-12 rounded-xl border border-input text-sm font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm appearance-none">
                     {paymentAccounts.map((pa) => <option key={pa.id} value={pa.id}>{pa.account_name}</option>)}
                   </select>
                </div>
             )}
          </div>
        )}

        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Subtotal</span>
            <span className="text-foreground font-bold">{formatCurrency(cartSubtotal)}</span>
          </div>
          {storeTaxRate > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Tax ({storeTaxRate}%)</span>
              <span className="text-foreground font-bold">{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="h-px w-full bg-border/50 my-2"></div>
          <div className="flex justify-between items-end">
            <span className="text-foreground font-black uppercase tracking-widest text-xs mb-1">Total</span>
            <span className="text-foreground font-black text-3xl tracking-tight">{formatCurrency(cartTotal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button 
            onClick={clearCart}
            disabled={cart.length === 0} 
            className="py-3.5 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            Cancel
          </button>
          <button 
            disabled={cart.length === 0}
            className="py-3.5 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            Hold
          </button>
        </div>
        <button 
          onClick={handleComplete} 
          disabled={isSubmitting || cart.length === 0}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-black text-base hover:opacity-90 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
          {isSubmitting ? (
             <>
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Processing...
             </>
          ) : (
             `Charge ${formatCurrency(cartTotal)}`
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-[#F8F9FA] dark:bg-background h-screen">
      {/* Mobile Checkout Toggle Overlay */}
      {showCheckoutMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCheckoutMobile(false)} />
          <div className="relative w-full sm:w-[420px] h-full ml-auto bg-background animate-in slide-in-from-right duration-300 p-0 shadow-2xl border-l border-border">
             <div className="absolute -left-12 top-4">
                <button onClick={() => setShowCheckoutMobile(false)} className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-foreground shadow-lg">
                   <X size={20} />
                </button>
             </div>
             <CheckoutPanel />
          </div>
        </div>
      )}

      {/* Left Area (Products) */}
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6 lg:pr-6 h-full overflow-hidden">
        
        {/* Top Header & Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="hidden lg:flex items-center justify-center w-12 h-12 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground shadow-sm transition-all shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex-1 flex gap-3">
            <div className="relative flex-1 group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Search products by name or barcode..."
                className="w-full pl-11 pr-4 py-3 h-12 rounded-xl border border-border bg-card text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all" 
              />
            </div>
            <button 
              onClick={() => setShowScanner(true)}
              className="w-12 h-12 rounded-xl border border-border bg-card flex items-center justify-center shrink-0 hover:bg-primary/5 hover:text-primary hover:border-primary/30 text-muted-foreground shadow-sm transition-all"
              title="Scan Barcode"
            >
              <ScanBarcode size={22} />
            </button>
          </div>
          
          <button 
            onClick={() => window.open('/customer-display', 'CustomerDisplay', 'width=1024,height=768')}
            className="hidden sm:flex items-center justify-center gap-2 px-6 h-12 rounded-xl border border-border bg-card text-sm font-bold hover:bg-muted text-foreground shadow-sm transition-all shrink-0">
            <Monitor size={18} />
            Display
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide shrink-0 snap-x">
          {activeParentId ? (
            <>
              <button 
                onClick={() => handleCategoryClick('Back')}
                className="px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all shadow-sm snap-start bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1">
                <ArrowLeft size={14} /> Back
              </button>
              <button 
                onClick={() => setActiveCategory('All')}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all shadow-sm snap-start ${
                  activeCategory === 'All'
                    ? 'bg-foreground text-background scale-105' 
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                All in {storeCategories.find(c => c.id === activeParentId)?.name}
              </button>
              {currentLevelCategories.map((cat) => (
                <button 
                  key={cat.id} 
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all shadow-sm snap-start ${
                    activeCategory === cat.id 
                      ? 'bg-foreground text-background scale-105' 
                      : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}>
                  {cat.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <button 
                onClick={() => handleCategoryClick('All')}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all shadow-sm snap-start ${
                  activeCategory === 'All' 
                    ? 'bg-foreground text-background scale-105' 
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                All
              </button>
              {currentLevelCategories.map((cat) => (
                <button 
                  key={cat.id} 
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all shadow-sm snap-start ${
                    activeCategory === cat.name 
                      ? 'bg-foreground text-background scale-105' 
                      : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}>
                  {cat.name}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pb-28 lg:pb-0 pr-1 -mr-1">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-3xl m-2">
              <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                <LayoutGrid size={32} className="opacity-50 text-foreground" />
              </div>
              <p className="font-black text-foreground text-xl">No products found</p>
              <p className="text-sm font-medium mt-2 max-w-sm text-center">Adjust your search query or select a different category to find products.</p>
            </div>
          ) : (
            <div className={`grid gap-4 ${cart.length === 0 ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'}`}>
              {filtered.map((item) => {
                const inCart = cart.find((c) => c.item.id === item.id);
                // Placeholder image generator based on product name
                const defaultImage = item.image_path || ("https://ui-avatars.com/api/?name=" + encodeURIComponent(item.name) + "&background=random&color=fff&size=200&bold=true");
                
                return (
                  <button 
                    key={item.id} 
                    onClick={() => addToCart(item, 1)}
                    className={`group flex flex-col bg-card rounded-3xl p-3 border hover:shadow-xl transition-all text-left relative overflow-hidden h-full ${inCart ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border/50 hover:border-primary/50'}`}
                  >
                    {inCart && (
                      <div className="absolute top-4 right-4 min-w-[32px] h-8 px-2 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center z-10 shadow-lg animate-in zoom-in duration-200">
                        {inCart.quantity}
                      </div>
                    )}
                    <div className="w-full aspect-square bg-muted/20 rounded-2xl mb-4 flex items-center justify-center overflow-hidden border border-border/30">
                       <img src={defaultImage} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex flex-col flex-1 px-1">
                       <h4 className="font-bold text-foreground text-sm line-clamp-2 leading-tight mb-2 group-hover:text-primary transition-colors">{item.name}</h4>
                       <div className="mt-auto flex items-center gap-2">
                          <span className="flex-1 text-sm font-black text-foreground">
                            {item.sell_price > 0 ? formatCurrency(item.sell_price) : 'Free'}
                          </span>
                       </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Area (Checkout Panel - Desktop Only) */}
      {cart.length > 0 && (
        <div className="hidden lg:block w-[400px] xl:w-[450px] p-6 pl-0 h-full animate-in fade-in slide-in-from-right-8 duration-300">
           <CheckoutPanel />
        </div>
      )}

      {/* Mobile Cart Floating Button */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-6 right-4 left-4 z-40 animate-in slide-in-from-bottom-10 duration-300">
          <button 
            onClick={() => setShowCheckoutMobile(true)}
            className="w-full h-16 rounded-2xl bg-foreground text-background font-bold shadow-2xl flex items-center justify-between px-6 hover:opacity-95 transition-all transform active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-background/20 flex items-center justify-center border border-background/20">
                <span className="text-sm font-black">{cart.reduce((s, c) => s + c.quantity, 0)}</span>
              </div>
              <span className="text-base font-bold uppercase tracking-wider">View Order</span>
            </div>
            <span className="text-xl font-black">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
