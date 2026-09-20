import React, { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Head } from '@inertiajs/react';

interface CartItemData {
  item: {
    id: string;
    name: string;
  };
  quantity: number;
  line_total: number;
}

export default function CustomerDisplayPage() {
  const [cart, setCart] = useState<CartItemData[]>([]);
  const [currency, setCurrency] = useState('KSh');
  const [storeName, setStoreName] = useState('My Store');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  useEffect(() => {
    document.title = "Customer Display - " + storeName;
  }, [storeName]);

  useEffect(() => {
    const channel = new BroadcastChannel('pos-cart-channel');
    
    channel.onmessage = (event) => {
      if (event.data.type === 'CART_UPDATE') {
        setCart(event.data.cart || []);
        if (event.data.currency) setCurrency(event.data.currency);
        if (event.data.currentStore) {
          setStoreName(event.data.currentStore.store_name || 'My Store');
          setTaxEnabled(event.data.currentStore.tax_enabled || false);
          setTaxRate(event.data.currentStore.tax_rate || 0);
        }
        setLastUpdated(Date.now());
      }
    };
    
    // Request current state from the active POS window
    channel.postMessage({ type: 'REQUEST_STATE' });

    return () => channel.close();
  }, []);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  const taxAmount = taxEnabled ? (cartSubtotal * (taxRate / 100)) : 0;
  const total = cartSubtotal + taxAmount;

  const formatCurrency = (amount: number) => {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <>
      <Head title="Customer Display" />
      <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden font-sans">
        
        {/* Left Side: Cart Items */}
        <div className="flex-1 p-6 md:p-12 flex flex-col bg-card overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <ShoppingCart size={32} />
            </div>
            <h1 className="text-4xl font-bold text-foreground">Your Order</h1>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-4 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                <ShoppingCart size={64} className="opacity-20" />
                <p className="text-2xl font-medium">Welcome to {storeName}!</p>
                <p className="text-lg">Please wait for the cashier to scan your items.</p>
              </div>
            ) : (
              cart.map((c, index) => (
                <div key={c.item.id + index} className="bg-accent/30 rounded-2xl p-6 flex items-center justify-between animate-fade-in">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-foreground">{c.item.name}</span>
                    <span className="text-lg text-muted-foreground mt-1">Qty: {c.quantity}</span>
                  </div>
                  <span className="text-3xl font-black text-primary">{formatCurrency(c.line_total)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Total */}
        <div className="w-full md:w-[500px] bg-primary text-primary-foreground p-8 md:p-12 flex flex-col justify-between shadow-2xl z-10">
          <div>
            <h2 className="text-3xl font-bold opacity-90">{storeName}</h2>
            <div className="w-16 h-1 bg-primary-foreground/20 mt-4 rounded-full"></div>
          </div>
          
          <div className="my-12">
            {taxEnabled && taxRate > 0 && (
              <div className="mb-6 space-y-2 text-primary-foreground/80">
                <div className="flex justify-between items-center text-xl">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xl border-b border-primary-foreground/20 pb-4">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              </div>
            )}
            <p className="text-2xl font-medium opacity-80 mb-2">Total Due</p>
            <p className="text-6xl md:text-7xl font-black tracking-tight">{formatCurrency(total)}</p>
          </div>
          
          <div className="bg-primary-foreground/10 rounded-2xl p-6 backdrop-blur-sm">
            <p className="text-xl font-medium text-center">Thank you for shopping with us!</p>
          </div>
        </div>

      </div>
    </>
  );
}
