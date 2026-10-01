import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { Search, X, ChevronLeft, Receipt, Plus, Users, Building2, CreditCard, User, Landmark, Activity } from 'lucide-react';
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
  const { customerDebts, customers, sales, recordPayment, currentStore, formatCurrency, user, refreshData } = useApp();
  const [tab, setTab] = useState<'customers' | 'your'>('customers');
  const [search, setSearch] = useState('');
  
  // Payment state for side panel
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash'); // Legacy

  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);

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
  
  // Add Credit modal state
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

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    recordPayment({
      store_id: currentStore?.id || '',
      sale_id: null,
      customer_id: selectedCustomer,
      supplier_id: null,
      payment_type: 'debt_collection',
      direction: 'in',
      method: payMethod as any,
      payment_account_id: paymentAccountId,
      amount: Number(payAmount),
      reference: '',
      created_by: user?.id || '',
    });
    setPayAmount('');
    toast.success('Payment recorded successfully');
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  // --------------------------------------------------------------------------
  // Detail View (Selected Customer)
  // --------------------------------------------------------------------------
  if (selectedCustomer && selectedCustomerInfo) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-background pb-12">
        <PageHeader 
          title={selectedCustomerInfo.customer_name} 
          leftAction={
            <button 
              onClick={() => setSelectedCustomer(null)} 
              className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-all mr-4 bg-card border border-border shadow-sm px-4 py-2.5 rounded-xl hover:bg-accent"
            >
              <ChevronLeft size={16} /> Back
            </button>
          }
        />
        
        <div className="p-4 sm:p-6 md:px-8 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Area: Outstanding Debts */}
            <div className="lg:col-span-2 space-y-6">
              <h3 className="font-black text-foreground text-xl capitalize">Outstanding Debts</h3>
              
              <div className="hidden md:block bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/10">
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest">Date & Reference</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest text-right">Original Amount</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {customerDetailDebts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center">
                          <Receipt size={32} className="mx-auto mb-4 text-muted-foreground/30" />
                          <p className="text-muted-foreground font-medium">No outstanding debts.</p>
                        </td>
                      </tr>
                    ) : (
                      customerDetailDebts.map(debt => {
                        const sale = debt.sale_id ? sales.find(s => s.id === debt.sale_id) : null;
                        return (
                          <tr key={debt.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-4">
                               <div className="font-medium text-sm text-foreground">
                                 {new Date(debt.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                               </div>
                               <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mt-1">
                                  <Receipt size={12} />
                                  {sale ? sale.receipt_no : 'Manual Credit'}
                               </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-right text-muted-foreground">
                              {formatCurrency(debt.original_amount)}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-destructive text-right">
                              {formatCurrency(debt.balance_amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacking Cards */}
              <div className="md:hidden space-y-4">
                 {customerDetailDebts.map(debt => {
                    const sale = debt.sale_id ? sales.find(s => s.id === debt.sale_id) : null;
                    return (
                       <div key={debt.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                             <div>
                                <h4 className="font-bold text-foreground text-sm capitalize">
                                   {new Date(debt.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </h4>
                                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mt-1">
                                   <Receipt size={12} />
                                   {sale ? sale.receipt_no : 'Manual Credit'}
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="text-[10px] font-bold text-muted-foreground  capitalize tracking-widest mb-0.5">Balance Due</p>
                                <p className="font-black text-destructive">{formatCurrency(debt.balance_amount)}</p>
                             </div>
                          </div>
                          <div className="pt-3 border-t border-border/50 flex justify-between items-center text-sm text-muted-foreground">
                             <span>Original Amount</span>
                             <span className="font-medium">{formatCurrency(debt.original_amount)}</span>
                          </div>
                       </div>
                    );
                 })}
              </div>

            </div>

            {/* Side Panel: Summary & Payment */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-3xl p-6 lg:sticky lg:top-24 shadow-sm flex flex-col gap-6">
                
                {/* Summary */}
                <div className="text-center p-6 bg-destructive/5 rounded-2xl border border-destructive/20 relative overflow-hidden">
                  <div className="absolute top-0 w-full h-1.5 bg-destructive"></div>
                  <p className="text-xs font-bold text-destructive  capitalize tracking-widest mb-2">Total Outstanding</p>
                  <p className="text-4xl font-black text-destructive mb-2">
                    {formatCurrency(selectedCustomerInfo.total_balance)}
                  </p>
                  <p className="text-sm font-medium text-destructive/80">{selectedCustomerInfo.customer_phone}</p>
                </div>

                <div className="h-px bg-border w-full"></div>

                {/* Payment Form */}
                <form onSubmit={handlePayment} className="space-y-5">
                  <h4 className="font-black text-foreground flex items-center gap-2 capitalize">
                    <CreditCard size={18} className="text-primary" />
                    Record Payment
                  </h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground  capitalize tracking-wider mb-2">Amount to pay</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">$</span>
                      <input 
                        type="number" 
                        value={payAmount} 
                        onChange={e => setPayAmount(e.target.value)} 
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all font-bold" 
                        required
                      />
                    </div>
                  </div>

                  {paymentAccounts.length > 0 ? (
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground  capitalize tracking-wider mb-2">Payment Account</label>
                      <select 
                        value={paymentAccountId || ''} 
                        onChange={e => setPaymentAccountId(e.target.value)}
                        className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all appearance-none"
                      >
                        {paymentAccounts.map(pa => <option key={pa.id} value={pa.id}>{pa.account_name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground  capitalize tracking-wider mb-2">Payment Method</label>
                      <select 
                        value={payMethod} 
                        onChange={e => setPayMethod(e.target.value)}
                        className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all appearance-none"
                      >
                        <option value="cash">Cash</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="w-full h-11 mt-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2 capitalize"
                  >
                    <Plus size={16} /> Submit Payment
                  </button>
                </form>

              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Main List View
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-background pb-12">
      <PageHeader 
        title="Credit Records" 
        rightAction={
          <button 
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Credit</span>
          </button>
        }
      />
      
      <div className="p-4 sm:p-6 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Top Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col justify-center items-center text-center col-span-1 md:col-span-2 relative overflow-hidden">
             <div className="absolute top-0 w-full h-2 bg-destructive"></div>
             <p className="text-sm font-bold text-muted-foreground  capitalize tracking-widest mb-3">Total Customer Debt</p>
             <p className="text-5xl md:text-6xl font-black text-destructive tracking-tighter">
               {formatCurrency(totalOwed)}
             </p>
           </div>
           
           <div className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col justify-center gap-4">
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Users size={20} />
                 </div>
                 <div>
                    <p className="text-xs font-bold text-muted-foreground  capitalize tracking-widest">Debtors</p>
                    <p className="text-xl font-black text-foreground">{aggregatedDebts.length}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Activity size={20} />
                 </div>
                 <div>
                    <p className="text-xs font-bold text-muted-foreground  capitalize tracking-widest">Active Records</p>
                    <p className="text-xl font-black text-foreground">{storeDebts.length}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Controls */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex bg-muted p-1.5 rounded-xl w-full sm:w-auto">
            <button 
              onClick={() => setTab('customers')}
              className={`flex-1 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${tab === 'customers' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Users size={16} />
              Customers
            </button>
            <button 
              onClick={() => setTab('your')}
              className={`flex-1 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${tab === 'your' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Building2 size={16} />
              Suppliers
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search by name or phone..."
              className="w-full pl-11 pr-4 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" 
            />
          </div>
        </div>

        {/* Content Area */}
        {tab === 'customers' ? (
           <>
             {/* Desktop Table */}
             <div className="hidden md:block bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-border/50 bg-muted/10">
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest">Customer Details</th>
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest text-center">Records</th>
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest text-right">Total Debt</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border/50">
                   {filteredDebts.length === 0 ? (
                     <tr>
                       <td colSpan={3} className="px-6 py-16 text-center">
                         <Users size={40} className="mx-auto mb-4 text-muted-foreground/30" />
                         <p className="font-bold text-foreground text-lg mb-1">No credit records found</p>
                         <p className="text-muted-foreground text-sm">Create a credit record to track debts.</p>
                       </td>
                     </tr>
                   ) : (
                     filteredDebts.map(debt => (
                       <tr 
                         key={debt.customer_id} 
                         onClick={() => setSelectedCustomer(debt.customer_id)}
                         className="hover:bg-muted/30 transition-colors cursor-pointer group"
                       >
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                 {debt.customer_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                 <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{debt.customer_name}</span>
                                 {debt.customer_phone && <span className="text-xs text-muted-foreground mt-0.5">{debt.customer_phone}</span>}
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-center">
                           <span className="inline-flex items-center justify-center bg-muted text-foreground rounded-lg px-3 py-1 text-xs font-bold border border-border">
                             {debt.debt_count} records
                           </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                           <span className="font-black text-destructive text-base">{formatCurrency(debt.total_balance)}</span>
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>

             {/* Mobile Cards */}
             <div className="md:hidden space-y-4">
               {filteredDebts.map(debt => (
                 <div 
                   key={debt.customer_id}
                   onClick={() => setSelectedCustomer(debt.customer_id)} 
                   className="bg-card rounded-2xl border border-border p-5 shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
                 >
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                           {debt.customer_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                           <h4 className="font-bold text-foreground text-base leading-tight capitalize">{debt.customer_name}</h4>
                           {debt.customer_phone && <span className="text-xs font-mono text-muted-foreground mt-0.5 inline-block">{debt.customer_phone}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                         <span className="font-black text-destructive block">{formatCurrency(debt.total_balance)}</span>
                      </div>
                   </div>
                   <div className="pt-3 border-t border-border/50">
                      <span className="inline-flex items-center justify-center bg-muted text-foreground rounded-lg px-2 py-0.5 text-xs font-bold border border-border">
                         {debt.debt_count} open {debt.debt_count === 1 ? 'record' : 'records'}
                      </span>
                   </div>
                 </div>
               ))}
             </div>
           </>
        ) : (
          <div className="bg-card rounded-3xl border border-border p-16 text-center shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
               <Landmark size={40} className="text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 capitalize">No supplier debts</h3>
            <p className="text-muted-foreground">You don't have any outstanding debts to suppliers.</p>
          </div>
        )}
      </div>

      {/* Add Credit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/10">
              <h3 className="text-xl font-bold text-foreground capitalize">Add Credit Record</h3>
              <button 
                onClick={() => setShowAdd(false)}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 sm:p-8">
              {customers.length === 0 ? (
                <div className="text-center py-8">
                  <User size={40} className="mx-auto mb-4 text-muted-foreground/30" />
                  <p className="font-bold text-foreground mb-2">No customers available</p>
                  <p className="text-muted-foreground text-sm">Add customers first before creating credit records.</p>
                </div>
              ) : (
                <form onSubmit={handleAddCredit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground  capitalize tracking-wider mb-2">Customer <span className="text-destructive">*</span></label>
                    <select 
                      value={addCustomerId} 
                      onChange={e => setAddCustomerId(e.target.value)}
                      className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all appearance-none"
                      required
                    >
                      <option value="">Select Customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `- ${c.phone}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground  capitalize tracking-wider mb-2">Amount <span className="text-destructive">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">$</span>
                      <input 
                        type="number" 
                        value={addAmount} 
                        onChange={e => setAddAmount(e.target.value)}
                        placeholder="0.00" 
                        className="w-full pl-8 pr-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all font-bold" 
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground  capitalize tracking-wider mb-2">Note <span className="lowercase font-medium">(optional)</span></label>
                    <input 
                      value={addNote} 
                      onChange={e => setAddNote(e.target.value)}
                      placeholder="Additional details..." 
                      className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all" 
                    />
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-border mt-8">
                    <button 
                      type="button"
                      onClick={() => setShowAdd(false)} 
                      className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 capitalize"
                    >
                      <Plus size={16} /> Add Record
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
