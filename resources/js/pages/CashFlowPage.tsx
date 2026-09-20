import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';
import { DollarSign, Wallet, BarChart3 } from 'lucide-react';

interface PaymentAccount {
  id: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
}

export default function CashFlowPage() {
  const { sales, expenses, payments, cashMovements, addCashMovement, currentStore, formatCurrency } = useApp();
  const [openingCash, setOpeningCash] = useState(0);
  const [showCashIn, setShowCashIn] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [moveAmount, setMoveAmount] = useState('');
  const [moveNote, setMoveNote] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);

  useEffect(() => {
    if (!currentStore) return;
    apiClient
      .from('payment_accounts')
      .select('id, account_name, account_type, is_active')
      .eq('store_id', currentStore.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setPaymentAccounts(data);
      });
  }, [currentStore?.id]);

  const today = new Date().toDateString();
  const todaySales = sales.filter(s => s.store_id === currentStore?.id && new Date(s.sold_at).toDateString() === today);
  const todayExpenses = expenses.filter(e => e.store_id === currentStore?.id && new Date(e.created_at).toDateString() === today);
  const todayPayments = payments.filter(p => p.store_id === currentStore?.id && new Date(p.created_at).toDateString() === today);

  // Dynamic breakdown by payment account
  const salesByAccount = paymentAccounts.map(acc => {
    const total = todayPayments
      .filter(p => p.payment_type === 'sale' && p.method === acc.account_name)
      .reduce((s, p) => s + p.amount, 0);
    return { account: acc, total };
  });

  const totalSales = todaySales.reduce((s, sale) => s + sale.paid_amount, 0);
  
  // Expenses breakdown by payment account
  const expensesByAccount = paymentAccounts.map(acc => {
    const total = todayExpenses
      .filter(e => e.payment_method === acc.account_name)
      .reduce((s, e) => s + e.amount, 0);
    return { account: acc, total };
  });
  const totalExpensesAmount = todayExpenses.reduce((s, e) => s + e.amount, 0);

  const manualIn = cashMovements.filter(m => m.direction === 'in' && new Date(m.created_at).toDateString() === today).reduce((s, m) => s + m.amount, 0);
  const manualOut = cashMovements.filter(m => m.direction === 'out' && new Date(m.created_at).toDateString() === today).reduce((s, m) => s + m.amount, 0);

  // Closing cash only counts "Cash" type accounts
  const cashAccountSales = todayPayments
    .filter(p => p.payment_type === 'sale' && paymentAccounts.some(a => a.account_name === p.method && a.account_type === 'Cash'))
    .reduce((s, p) => s + p.amount, 0);
  const cashExpenses = todayExpenses
    .filter(e => paymentAccounts.some(a => a.account_name === e.payment_method && a.account_type === 'Cash'))
    .reduce((s, e) => s + e.amount, 0);
  const closingCash = openingCash + cashAccountSales + manualIn - cashExpenses - manualOut;

  const handleCashMove = (direction: 'in' | 'out') => {
    addCashMovement({
      store_id: currentStore?.id || '',
      cash_session_id: '',
      movement_type: 'manual',
      direction,
      amount: Number(moveAmount),
      source_module: 'manual',
      reference_id: '',
      note: moveNote,
    });
    setMoveAmount(''); setMoveNote('');
    setShowCashIn(false); setShowCashOut(false);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Cash': return DollarSign;
      case 'Mobile Money': return Wallet;
      case 'Bank': return BarChart3;
      default: return Wallet;
    }
  };

  const InfoCard = ({ icon: Icon, label, value, color = 'text-primary' }: { icon: any; label: string; value: string; color?: string }) => (
    <div className="bg-card rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
        <Icon size={20} className={color} />
      </div>
      <span className="flex-1 text-foreground">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Cash Flow Tracker" />
      <div className="px-4 py-4 space-y-4">
        {/* Date & Cash Summary */}
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-lg font-medium text-foreground">{new Date().toLocaleDateString()}</p>
          <div className="flex justify-between mt-3">
            <div>
              <p className="text-xs text-muted-foreground">Opening Cash</p>
              <input type="number" value={openingCash} onChange={e => setOpeningCash(Number(e.target.value))}
                className="w-24 text-center font-bold text-primary bg-transparent border-b border-input" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closing Cash</p>
              <p className="font-bold text-primary">{formatCurrency(closingCash)}</p>
            </div>
          </div>
        </div>

        {/* Cash In / Out Buttons */}
        <div className="flex gap-3">
          <button onClick={() => setShowCashIn(true)} className="flex-1 py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98]">Cash In</button>
          <button onClick={() => setShowCashOut(true)} className="flex-1 py-4 rounded-xl bg-destructive text-destructive-foreground font-bold active:scale-[0.98]">Cash Out</button>
        </div>

        {/* Inflows - Dynamic per payment account */}
        <h3 className="font-bold text-muted-foreground text-sm uppercase">Sales by Payment Account</h3>
        {salesByAccount.map(({ account, total }) => (
          <InfoCard key={account.id} icon={getAccountIcon(account.account_type)} label={account.account_name} value={formatCurrency(total)} />
        ))}
        <InfoCard icon={BarChart3} label="Total Sales" value={formatCurrency(totalSales)} />

        {/* Outflows - Dynamic per payment account */}
        <h3 className="font-bold text-muted-foreground text-sm uppercase">Outflows</h3>
        {expensesByAccount.filter(e => e.total > 0).map(({ account, total }) => (
          <InfoCard key={account.id} icon={getAccountIcon(account.account_type)} label={`Expenses (${account.account_name})`} value={formatCurrency(total)} color="text-destructive" />
        ))}
        {totalExpensesAmount === 0 && (
          <InfoCard icon={DollarSign} label="Expenses" value={formatCurrency(0)} color="text-destructive" />
        )}
        <InfoCard icon={DollarSign} label="Manual Cash Out" value={formatCurrency(manualOut)} color="text-destructive" />
      </div>

      {/* Cash In/Out Modal */}
      {(showCashIn || showCashOut) && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">{showCashIn ? 'Cash In' : 'Cash Out'}</h3>
            <input type="number" value={moveAmount} onChange={e => setMoveAmount(e.target.value)} placeholder="Amount"
              className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mb-3" />
            <input value={moveNote} onChange={e => setMoveNote(e.target.value)} placeholder="Note"
              className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setShowCashIn(false); setShowCashOut(false); }} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
              <button onClick={() => handleCashMove(showCashIn ? 'in' : 'out')} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
