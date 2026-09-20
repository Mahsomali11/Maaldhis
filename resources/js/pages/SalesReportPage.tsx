import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';
import BottomNav from '@/components/BottomNav';
import { TrendingUp, TrendingDown, DollarSign, Package, Wallet, BarChart3 } from 'lucide-react';

interface PaymentAccount {
  id: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
}

export default function SalesReportPage() {
  const { sales, saleItems, expenses, payments, returns, currentStore, formatCurrency } = useApp();
  const [tab, setTab] = useState<'today' | 'month' | 'all'>('today');
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

  // Group payments by method dynamically from payment accounts
  const salePaymentsByMethod = paymentAccounts.map(acc => {
    const total = filteredPayments
      .filter(p => p.payment_type === 'sale' && p.method === acc.account_name)
      .reduce((s, p) => s + p.amount, 0);
    return { account: acc, total };
  }).filter(item => item.total > 0 || paymentAccounts.length <= 6); // show all if few accounts, or only used ones

  const creditPaymentsByMethod = paymentAccounts.map(acc => {
    const total = filteredPayments
      .filter(p => p.payment_type === 'debt_collection' && p.method === acc.account_name)
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

  const dateDisplay = tab === 'today' ? now.toLocaleDateString('en-GB') : tab === 'month' ? now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'All Time';

  const MetricCard = ({ icon: Icon, label, value, color = 'text-primary', bgColor = 'bg-primary/10' }: any) => (
    <div className="bg-card rounded-xl p-4 flex items-center gap-3 ring-1 ring-border">
      <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center shrink-0`}>
        <Icon size={20} className={color} />
      </div>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Cash': return DollarSign;
      case 'Mobile Money': return Wallet;
      case 'Bank': return BarChart3;
      default: return Wallet;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <PageHeader title="Sales Report" />
      <div className="px-4 lg:px-8 py-4 lg:py-6 space-y-4 max-w-7xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex gap-0 bg-card rounded-xl overflow-hidden lg:max-w-sm">
          {(['today', 'month', 'all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 font-medium text-sm capitalize ${tab === t ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
              {t === 'month' ? 'This Month' : t === 'all' ? 'All Time' : 'Today'}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl p-4 text-center lg:text-left lg:max-w-sm">
          <p className="text-lg font-medium text-foreground">{dateDisplay}</p>
        </div>

        {filteredSales.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">There are no transactions {tab === 'today' ? 'today' : 'in this period'}.</p>
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6">
            {/* Dynamic payment methods from payment accounts */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
              <div className="space-y-2">
                <h3 className="font-bold text-muted-foreground text-xs uppercase">Payment Methods (Cash Sales)</h3>
                {salePaymentsByMethod.length > 0 ? (
                  salePaymentsByMethod.map(({ account, total }) => (
                    <MetricCard
                      key={account.id}
                      icon={getAccountIcon(account.account_type)}
                      label={account.account_name}
                      value={formatCurrency(total)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No payment accounts configured</p>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-muted-foreground text-xs uppercase">Payment Methods (Credit Payments)</h3>
                {creditPaymentsByMethod.length > 0 ? (
                  creditPaymentsByMethod.map(({ account, total }) => (
                    <MetricCard
                      key={account.id}
                      icon={getAccountIcon(account.account_type)}
                      label={account.account_name}
                      value={formatCurrency(total)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No payment accounts configured</p>
                )}
              </div>
            </div>

            <h3 className="font-bold text-muted-foreground text-xs uppercase">Financial Summary</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MetricCard icon={BarChart3} label="Total Sales Revenue" value={formatCurrency(totalSalesRevenue)} color="text-info" bgColor="bg-info/10" />
              <MetricCard icon={BarChart3} label="Total Credit Payments" value={formatCurrency(totalCreditPayments)} color="text-info" bgColor="bg-info/10" />
              <MetricCard icon={TrendingUp} label="Gross Sales Profit" value={formatCurrency(grossSalesProfit)} />
              <MetricCard icon={TrendingUp} label="Gross Credit Profit" value={formatCurrency(grossCreditProfit)} />
              <MetricCard icon={TrendingDown} label="Total Loss" value={`-${formatCurrency(totalLoss)}`} color="text-destructive" bgColor="bg-destructive/10" />
              <MetricCard icon={DollarSign} label="Expenses" value={formatCurrency(totalExpenses)} color="text-destructive" bgColor="bg-destructive/10" />
              <MetricCard icon={TrendingUp} label="Net Profit" value={formatCurrency(netProfit)} color={netProfit >= 0 ? 'text-primary' : 'text-destructive'} bgColor={netProfit >= 0 ? 'bg-primary/10' : 'bg-destructive/10'} />
              {currentStore?.tax_enabled && (
                <MetricCard icon={DollarSign} label="Total Tax Collected" value={formatCurrency(totalTaxCollected)} color="text-info" bgColor="bg-info/10" />
              )}
              <MetricCard icon={Package} label="Total Items Sold" value={totalItemsSold} color="text-info" bgColor="bg-info/10" />
            </div>
          </div>
        )}
      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
