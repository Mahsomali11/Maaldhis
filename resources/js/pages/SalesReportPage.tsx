import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';
import { TrendingUp, TrendingDown, DollarSign, Package, Wallet, BarChart3, CalendarDays, Activity } from 'lucide-react';

interface PaymentAccount {
  id: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
}

export default function SalesReportPage() {
  const { sales, saleItems, expenses, payments, currentStore, formatCurrency } = useApp();
  const [tab, setTab] = useState<'today' | 'month' | 'all'>('today');
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
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

  const now = new Date();
  const today = now.toDateString();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const filterSales = (s: typeof sales[0]) => {
    if (s.store_id !== currentStore?.id || s.status === 'voided') return false;
    if (selectedAccountId !== 'all' && s.payment_account_id !== selectedAccountId) return false;
    const d = new Date(s.sold_at);
    if (tab === 'today') return d.toDateString() === today;
    if (tab === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    return true;
  };

  const filteredSales = sales.filter(filterSales);
  const filteredSaleItems = saleItems.filter(si => filteredSales.some(s => s.id === si.sale_id));
  const filteredExpenses = expenses.filter(e => {
    if (e.store_id !== currentStore?.id) return false;
    const d = new Date(e.created_at);
    if (tab === 'today') return d.toDateString() === today;
    if (tab === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    return true;
  });
  const filteredPayments = payments.filter(p => {
    if (p.store_id !== currentStore?.id) return false;
    const d = new Date(p.created_at);
    if (tab === 'today') return d.toDateString() === today;
    if (tab === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    return true;
  });

  const salePaymentsByMethod = paymentAccounts.map(acc => {
    const total = filteredSales
      .filter(s => s.payment_account_id === acc.id)
      .reduce((s, sale) => s + sale.paid_amount, 0);
    return { account: acc, total };
  }).filter(item => item.total > 0 || paymentAccounts.length <= 6);

  const creditPaymentsByMethod = paymentAccounts.map(acc => {
    const total = filteredPayments
      .filter(p => p.payment_type === 'debt_collection' && p.payment_account_id === acc.id)
      .reduce((s, p) => s + p.amount, 0);
    return { account: acc, total };
  }).filter(item => item.total > 0 || paymentAccounts.length <= 6);

  const totalSalesRevenue = filteredSales.reduce((s, sale) => s + sale.total, 0);
  const totalCreditPayments = filteredPayments.filter(p => p.payment_type === 'debt_collection').reduce((s, p) => s + p.amount, 0);

  const cashSales = filteredSales.filter(s => s.sale_type === 'cash');
  const creditSales = filteredSales.filter(s => s.sale_type === 'credit' || s.sale_type === 'mixed');

  const grossSalesProfit = filteredSaleItems
    .filter(si => cashSales.some(s => s.id === si.sale_id))
    .reduce((sum, si) => sum + (si.sell_price - si.cost_price) * si.quantity, 0);

  const grossCreditProfit = filteredSaleItems
    .filter(si => creditSales.some(s => s.id === si.sale_id))
    .reduce((sum, si) => sum + (si.sell_price - si.cost_price) * si.quantity, 0);

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalTaxCollected = filteredSales.reduce((s, sale) => s + (sale.tax || 0), 0);
  const totalLoss = 0;
  const netProfit = grossSalesProfit + grossCreditProfit - totalExpenses - totalLoss;
  const totalItemsSold = filteredSaleItems.reduce((s, si) => s + si.quantity, 0);

  const dateDisplay = tab === 'today' ? now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : tab === 'month' ? now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'All Time';

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Cash': return DollarSign;
      case 'Mobile Money': return Wallet;
      case 'Bank': return BarChart3;
      default: return Wallet;
    }
  };

  const MetricCard = ({ icon: Icon, label, value, color = 'text-primary', bgColor = 'bg-primary/10' }: any) => (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex items-center gap-5 transition-transform hover:-translate-y-1">
      <div className={`w-14 h-14 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
        <Icon size={24} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-muted-foreground  capitalize tracking-wider mb-1 truncate">{label}</p>
        <p className={`text-2xl font-black ${color} truncate tracking-tight`}>{value}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-background pb-12">
      <PageHeader 
        title="Sales Report" 
        rightAction={
          <div className="flex items-center gap-4">
            <select 
              value={selectedAccountId} 
              onChange={e => setSelectedAccountId(e.target.value)}
              className="px-4 py-2 h-10 rounded-xl border border-border bg-card text-sm font-bold shadow-sm focus:outline-none focus:border-primary transition-colors appearance-none"
            >
              <option value="all">All Payment Accounts</option>
              {paymentAccounts.map(pa => (
                <option key={pa.id} value={pa.id}>{pa.account_name}</option>
              ))}
            </select>
            <div className="flex bg-muted/50 p-1.5 rounded-xl border border-border">
              {(['today', 'month', 'all'] as const).map(t => (
                <button 
                  key={t} 
                  onClick={() => setTab(t)}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 capitalize ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  {t === 'month' ? 'This Month' : t === 'all' ? 'All Time' : 'Today'}
                </button>
              ))}
            </div>
          </div>
        }
      />
      
      <div className="p-4 sm:p-6 md:px-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Date Display */}
        <div className="flex items-center gap-3 text-foreground bg-card p-4 rounded-xl border border-border shadow-sm inline-flex">
          <CalendarDays size={20} className="text-primary" />
          <h2 className="text-base font-bold capitalize">{dateDisplay}</h2>
        </div>

        {filteredSales.length === 0 && tab !== 'all' ? (
          <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <Activity size={40} className="text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 capitalize">No transactions</h3>
            <p className="text-muted-foreground">There are no transactions in this period.</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Top Level Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col justify-center items-center text-center overflow-hidden relative">
                <div className={`absolute top-0 w-full h-2 ${netProfit >= 0 ? 'bg-success' : 'bg-destructive'}`}></div>
                <p className="text-sm font-bold text-muted-foreground  capitalize tracking-widest mb-3">Net Profit</p>
                <p className={`text-5xl md:text-6xl font-black tracking-tighter ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(netProfit)}
                </p>
                <div className={`mt-6 px-4 py-1.5 rounded-full text-xs font-bold  capitalize tracking-wider ${netProfit >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {netProfit >= 0 ? 'Profitable' : 'Loss'}
                </div>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <MetricCard icon={BarChart3} label="Total Sales Revenue" value={formatCurrency(totalSalesRevenue)} color="text-primary" bgColor="bg-primary/10" />
                <MetricCard icon={TrendingUp} label="Gross Sales Profit" value={formatCurrency(grossSalesProfit)} color="text-success" bgColor="bg-success/10" />
                <MetricCard icon={BarChart3} label="Total Credit Payments" value={formatCurrency(totalCreditPayments)} color="text-blue-500" bgColor="bg-blue-500/10" />
                <MetricCard icon={TrendingUp} label="Gross Credit Profit" value={formatCurrency(grossCreditProfit)} color="text-success" bgColor="bg-success/10" />
                <MetricCard icon={DollarSign} label="Expenses" value={formatCurrency(totalExpenses)} color="text-destructive" bgColor="bg-destructive/10" />
                <MetricCard icon={TrendingDown} label="Total Loss" value={formatCurrency(totalLoss)} color="text-destructive" bgColor="bg-destructive/10" />
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <MetricCard icon={Package} label="Total Items Sold" value={totalItemsSold.toString()} color="text-foreground" bgColor="bg-muted" />
              {currentStore?.tax_enabled && (
                <MetricCard icon={DollarSign} label="Total Tax Collected" value={formatCurrency(totalTaxCollected)} color="text-amber-500" bgColor="bg-amber-500/10" />
              )}
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-4">
              <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
                <h3 className="font-black text-foreground text-xl mb-6 capitalize">Payment Methods <span className="text-muted-foreground font-medium text-lg">(Cash Sales)</span></h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {salePaymentsByMethod.length > 0 ? (
                    salePaymentsByMethod.map(({ account, total }) => (
                      <MetricCard
                        key={account.id}
                        icon={getAccountIcon(account.account_type)}
                        label={account.account_name}
                        value={formatCurrency(total)}
                        color="text-primary"
                        bgColor="bg-primary/10"
                      />
                    ))
                  ) : (
                    <div className="col-span-2 p-8 border border-dashed border-border rounded-2xl text-center">
                       <p className="text-sm font-bold text-muted-foreground">No payment accounts configured</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
                <h3 className="font-black text-foreground text-xl mb-6 capitalize">Payment Methods <span className="text-muted-foreground font-medium text-lg">(Credit Payments)</span></h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {creditPaymentsByMethod.length > 0 ? (
                    creditPaymentsByMethod.map(({ account, total }) => (
                      <MetricCard
                        key={account.id}
                        icon={getAccountIcon(account.account_type)}
                        label={account.account_name}
                        value={formatCurrency(total)}
                        color="text-blue-500"
                        bgColor="bg-blue-500/10"
                      />
                    ))
                  ) : (
                    <div className="col-span-2 p-8 border border-dashed border-border rounded-2xl text-center">
                       <p className="text-sm font-bold text-muted-foreground">No payment accounts configured</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            
            {/* Filtered Transactions List */}
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden mt-8">
               <div className="p-6 border-b border-border/50 bg-muted/10">
                 <h3 className="font-black text-foreground text-xl capitalize">Transactions List</h3>
                 <p className="text-sm text-muted-foreground mt-1">Filtered by your selected date and payment account.</p>
               </div>
               <table className="w-full text-left border-collapse">
                 <thead className="bg-muted/30 border-b border-border">
                   <tr>
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest">Time</th>
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest">Receipt</th>
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest">Type</th>
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest">Account</th>
                     <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground  capitalize tracking-widest text-right">Amount</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border/50">
                   {filteredSales.map(sale => {
                     const acc = paymentAccounts.find(pa => pa.id === sale.payment_account_id);
                     return (
                       <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                         <td className="px-6 py-4 text-sm font-medium text-foreground">
                            {new Date(sale.sold_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                         </td>
                         <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{sale.receipt_no}</td>
                         <td className="px-6 py-4">
                           <span className="px-2.5 py-1 rounded-full text-[10px] font-bold  capitalize tracking-wider bg-success/10 text-success">
                             {sale.sale_type} sale
                           </span>
                         </td>
                         <td className="px-6 py-4 text-sm font-bold text-foreground">
                           {acc ? acc.account_name : 'Cash'}
                         </td>
                         <td className="px-6 py-4 text-right font-black text-base text-success">
                           +{formatCurrency(sale.paid_amount)}
                         </td>
                       </tr>
                     );
                   })}
                   {filteredSales.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm font-medium">No sales found matching these filters.</td>
                      </tr>
                   )}
                 </tbody>
               </table>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
