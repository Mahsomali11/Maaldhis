import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';
import { Search, X, ChevronLeft, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { api as apiClient } from '@/api';

interface AggregatedDebt {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  total_balance: number;
  total_original: number;
  debt_count: number;
}

export default function CreditRecordPage() {
  const { customerDebts, customers, sales, saleItems, recordPayment, currentStore, formatCurrency, user, refreshData } = useApp();
  const [tab, setTab] = useState<'customers' | 'your'>('customers');
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [showAdd, setShowAdd] = useState(false);
  const [addCustomerId, setAddCustomerId] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addNote, setAddNote] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const storeDebts = customerDebts.filter(d => d.store_id === currentStore?.id);

  // Aggregate debts by customer
  const aggregatedDebts = useMemo(() => {
    const map = new Map<string, AggregatedDebt>();
    for (const d of storeDebts) {
      if (d.balance_amount <= 0) continue;
      const existing = map.get(d.customer_id);
      const customer = customers.find(c => c.id === d.customer_id);
      if (existing) {
        existing.total_balance += d.balance_amount;
        existing.total_original += d.original_amount;
        existing.debt_count += 1;
      } else {
        map.set(d.customer_id, {
          customer_id: d.customer_id,
          customer_name: d.customer_name || customer?.name || 'Unknown',
          customer_phone: customer?.phone || '',
          total_balance: d.balance_amount,
          total_original: d.original_amount,
          debt_count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [storeDebts, customers]);

  const filteredDebts = aggregatedDebts.filter(d => {
    const searchLower = search.toLowerCase();
    return d.customer_name.toLowerCase().includes(searchLower) ||
      d.customer_phone.includes(search);
  });
  const totalOwed = aggregatedDebts.reduce((s, d) => s + d.total_balance, 0);

  // Get individual debts for selected customer
  const customerDetailDebts = selectedCustomer
    ? storeDebts.filter(d => d.customer_id === selectedCustomer && d.balance_amount > 0)
    : [];
  const selectedCustomerInfo = selectedCustomer
    ? aggregatedDebts.find(d => d.customer_id === selectedCustomer)
    : null;

  const handlePayment = () => {
    if (!showPayment) return;
    recordPayment({
      store_id: currentStore?.id || '',
      sale_id: null,
      customer_id: showPayment,
      supplier_id: null,
      payment_type: 'debt_collection',
      direction: 'in',
      method: payMethod as any,
      amount: Number(payAmount),
      reference: '',
      created_by: user?.id || '',
    });
    setShowPayment(null);
    setPayAmount('');
  };

  const handleAddCredit = async () => {
    if (!addCustomerId || !addAmount || Number(addAmount) <= 0) {
      toast.error('Select a customer and enter a valid amount');
      return;
    }
    const customer = customers.find(c => c.id === addCustomerId);
    const { error } = await apiClient.from('customer_debts').insert({
      store_id: currentStore?.id || '',
      customer_id: addCustomerId,
      customer_name: customer?.name || '',
      original_amount: Number(addAmount),
      balance_amount: Number(addAmount),
      status: 'open',
    } as any);
    if (error) {
      toast.error('Failed to add credit record: ' + error.message);
      return;
    }
    toast.success('Credit record added');
    setShowAdd(false);
    setAddCustomerId('');
    setAddAmount('');
    setAddNote('');
    await refreshData();
  };

  // Customer detail view
  if (selectedCustomer && selectedCustomerInfo) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title={selectedCustomerInfo.customer_name} />
        <div className="px-4 py-4 space-y-4">
          <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-1 text-sm text-primary font-medium">
            <ChevronLeft size={16} /> Back to all customers
          </button>

          {/* Total debt summary */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Debt</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(selectedCustomerInfo.total_balance)}</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedCustomerInfo.customer_phone}</p>
          </div>

          <button onClick={() => setShowPayment(selectedCustomer)}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold">
            Record Payment
          </button>

          {/* Debt breakdown */}
          <h3 className="font-bold text-foreground">Outstanding Debts</h3>
          {customerDetailDebts.map(debt => {
            const sale = debt.sale_id ? sales.find(s => s.id === debt.sale_id) : null;
            return (
              <div key={debt.id} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex justify-between items-start">
                  <div>
                    {sale && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Receipt size={12} />
                        <span>{sale.receipt_no}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">{new Date(debt.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatCurrency(debt.balance_amount)}</p>
                    <p className="text-xs text-muted-foreground">of {formatCurrency(debt.original_amount)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {customerDetailDebts.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No outstanding debts.</p>
          )}
        </div>

        {/* Payment Modal */}
        {showPayment && (
          <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end">
            <div className="w-full bg-card rounded-t-2xl p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Record Payment</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Outstanding: {formatCurrency(selectedCustomerInfo.total_balance)}
              </p>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Payment amount"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mb-3" />
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mb-4">
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowPayment(null)} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
                <button onClick={handlePayment} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Record</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Credit Record" />
      <div className="px-4 py-4 space-y-4">
        <div className="flex bg-card rounded-xl overflow-hidden">
          <button onClick={() => setTab('customers')}
            className={`flex-1 py-3 font-medium text-sm ${tab === 'customers' ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
            Customers Debt
          </button>
          <button onClick={() => setTab('your')}
            className={`flex-1 py-3 font-medium text-sm ${tab === 'your' ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
            Your Debt
          </button>
        </div>

        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground" />
        </div>

        {tab === 'customers' ? (
          <>
            {filteredDebts.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center">
                <p className="text-muted-foreground">No credit records yet.</p>
                <p className="text-sm text-muted-foreground mt-2">Tap + to add a credit record.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {filteredDebts.map(debt => (
                    <button key={debt.customer_id} onClick={() => setSelectedCustomer(debt.customer_id)}
                      className="w-full bg-card rounded-xl p-4 flex items-center justify-between text-left border border-border">
                      <div>
                        <h4 className="font-semibold text-foreground">{debt.customer_name}</h4>
                        <p className="text-sm text-muted-foreground">{debt.customer_phone || 'No phone'}</p>
                        <p className="text-xs text-muted-foreground">{debt.debt_count} record{debt.debt_count > 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{formatCurrency(debt.total_balance)}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="bg-accent rounded-xl p-4 text-center">
                  <p className="text-lg text-primary font-bold">Total Customers Owe:</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalOwed)}</p>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="bg-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No supplier debts recorded yet.</p>
          </div>
        )}
      </div>

      {/* Add Credit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">Add Credit Record</h3>
              <button onClick={() => setShowAdd(false)}><X size={24} className="text-muted-foreground" /></button>
            </div>
            {customers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Add customers first before creating credit records.</p>
            ) : (
              <>
                <select value={addCustomerId} onChange={e => setAddCustomerId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mb-3">
                  <option value="">Select Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                  ))}
                </select>
                <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)}
                  placeholder="Credit amount" className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mb-3" />
                <input value={addNote} onChange={e => setAddNote(e.target.value)}
                  placeholder="Note (optional)" className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mb-4" />
                <div className="flex gap-3">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
                  <button onClick={handleAddCredit} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Add</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <FAB onClick={() => setShowAdd(true)} />
    </div>
  );
}
