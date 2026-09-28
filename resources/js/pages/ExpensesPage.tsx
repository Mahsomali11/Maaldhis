import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';
import { Plus, X, Receipt, Wallet, User, Clock } from 'lucide-react';

export default function ExpensesPage() {
  const { expenses, addExpense, currentStore, formatCurrency, user } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('cash'); // Keeps legacy method string
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

  const today = new Date().toDateString();
  const todayExpenses = expenses.filter(e => e.store_id === currentStore?.id && new Date(e.created_at).toDateString() === today);
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addExpense({
      store_id: currentStore?.id || '',
      expense_type: type,
      amount: Number(amount),
      note,
      employee_user_id: user?.id || null,
      employee_name: user?.full_name,
      payment_method: method,
      payment_account_id: paymentAccountId,
      created_by: user?.id || '',
    });
    setType(''); setAmount(''); setNote(''); setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-background pb-12">
      <PageHeader 
        title="Expenses" 
        rightAction={
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Expense</span>
          </button>
        }
      />
      
      <div className="p-4 sm:p-6 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Summary Column */}
          <div className="lg:col-span-1 lg:order-2">
            <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-sm flex flex-col justify-center items-center h-full min-h-[200px]">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                 <Wallet size={24} />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Today's Expenses</p>
              <p className="text-4xl font-black text-foreground">{formatCurrency(todayTotal)}</p>
            </div>
          </div>

          {/* Main Table Column */}
          <div className="lg:col-span-3 lg:order-1 space-y-4">
            
            {todayExpenses.length === 0 ? (
               <div className="bg-card rounded-3xl border border-border p-16 text-center shadow-sm flex flex-col items-center">
                 <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                   <Receipt size={32} className="text-muted-foreground/50" />
                 </div>
                 <h3 className="text-xl font-bold text-foreground mb-2">No expenses today</h3>
                 <p className="text-muted-foreground text-sm max-w-sm">Keep track of your operational costs by recording expenses here.</p>
                 <button 
                    onClick={() => setShowForm(true)}
                    className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-sm"
                  >
                    Add Expense
                  </button>
               </div>
            ) : (
              <>
                <div className="hidden md:block bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/10">
                        <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Type & Note</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Time</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Employee</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {todayExpenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-4">
                             <div className="flex flex-col">
                                <span className="font-bold text-foreground text-sm">{exp.expense_type}</span>
                                {exp.note && <span className="text-xs text-muted-foreground mt-0.5">{exp.note}</span>}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-muted-foreground">
                            {new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-foreground">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                   {exp.employee_name ? exp.employee_name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                {exp.employee_name || 'Unknown'}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-destructive text-right">
                            {formatCurrency(exp.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacking Cards */}
                <div className="md:hidden space-y-4">
                  {todayExpenses.map(exp => (
                    <div key={exp.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                       <div className="flex justify-between items-start mb-3">
                         <div>
                            <h4 className="font-bold text-foreground text-base leading-tight">{exp.expense_type}</h4>
                            {exp.note && <span className="text-xs text-muted-foreground mt-1 inline-block">{exp.note}</span>}
                         </div>
                         <span className="font-black text-destructive">{formatCurrency(exp.amount)}</span>
                       </div>
                       <div className="flex justify-between items-center pt-4 border-t border-border/50 text-xs text-muted-foreground font-medium">
                          <div className="flex items-center gap-1.5">
                             <Clock size={14} className="opacity-70" />
                             {new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-1.5">
                             <User size={14} className="opacity-70" />
                             {exp.employee_name || 'Unknown'}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/10">
              <h3 className="text-xl font-bold text-foreground">Add Expense</h3>
              <button 
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleAdd} className="p-6 sm:p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Expense Type <span className="text-destructive">*</span></label>
                <input 
                  value={type} 
                  onChange={e => setType(e.target.value)} 
                  placeholder="e.g., Rent, Transport, Meals"
                  className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all" 
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Amount <span className="text-destructive">*</span></label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  placeholder="0.00"
                  className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all" 
                  required 
                />
              </div>

              {paymentAccounts.length > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Payment Account</label>
                  <select 
                    value={paymentAccountId || ''} 
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all appearance-none"
                  >
                    {paymentAccounts.map(pa => (
                      <option key={pa.id} value={pa.id}>{pa.account_name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Payment Method</label>
                  <select 
                    value={method} 
                    onChange={e => setMethod(e.target.value)}
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all appearance-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="card">Card / Bank</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Note <span className="lowercase font-medium">(optional)</span></label>
                <input 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  placeholder="Additional details..."
                  className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all" 
                />
              </div>

              <div className="flex gap-3 pt-6 border-t border-border mt-8">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
