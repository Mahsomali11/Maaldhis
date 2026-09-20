import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Menu, Pencil, Store, ShoppingCart, Receipt, TrendingUp, CreditCard, Undo2, Package, BarChart3, Users, ArrowLeftRight, Clock, Truck, UserCog, FileText, ChevronRight, AlertTriangle, Lock } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ROUTE_FEATURE_MAP } from '@/lib/features';
import type { FeatureKey } from '@/lib/features';
import SideDrawer from '@/components/SideDrawer';
import BottomNav from '@/components/BottomNav';
import OnboardingCards from '@/components/OnboardingCards';
import TrialExpiryBanner from '@/components/TrialExpiryBanner';
import { toast } from 'sonner';

const tiles = [
  { label: 'EXPENSES', icon: Receipt, bg: 'bg-tile-pink', iconColor: 'text-destructive', ring: 'ring-destructive/20', path: '/expenses' },
  { label: 'CASH FLOW', icon: TrendingUp, bg: 'bg-tile-green', iconColor: 'text-primary', ring: 'ring-primary/20', path: '/cash-flow' },
  { label: 'CREDIT RECORD', icon: CreditCard, bg: 'bg-tile-yellow', iconColor: 'text-warning', ring: 'ring-warning/20', path: '/credit-record' },
  { label: 'RETURNS', icon: Undo2, bg: 'bg-tile-green', iconColor: 'text-primary', ring: 'ring-primary/20', path: '/returns' },
  { label: 'INVENTORY', icon: Package, bg: 'bg-tile-blue', iconColor: 'text-info', ring: 'ring-info/20', path: '/inventory' },
  { label: 'SALES REPORT', icon: BarChart3, bg: 'bg-tile-purple', iconColor: 'text-info', ring: 'ring-info/20', path: '/sales-report' },
  { label: 'CUSTOMERS', icon: Users, bg: 'bg-tile-pink', iconColor: 'text-destructive', ring: 'ring-destructive/20', path: '/customers' },
  { label: 'STOCK TRANSFERS', icon: ArrowLeftRight, bg: 'bg-tile-cyan', iconColor: 'text-primary', ring: 'ring-primary/20', path: '/stock-transfers' },
  { label: 'RECEIPT HISTORY', icon: Clock, bg: 'bg-tile-blue', iconColor: 'text-info', ring: 'ring-info/20', path: '/receipt-history' },
  { label: 'SUPPLY ORDERS', icon: Truck, bg: 'bg-tile-yellow', iconColor: 'text-warning', ring: 'ring-warning/20', path: '/suppliers' },
  { label: 'STAFF ACCOUNTS', icon: UserCog, bg: 'bg-tile-purple', iconColor: 'text-info', ring: 'ring-info/20', path: '/staff-accounts' },
  { label: 'STOCK REPORT', icon: FileText, bg: 'bg-tile-cyan', iconColor: 'text-primary', ring: 'ring-primary/20', path: '/stock-report' },
];

export default function DashboardPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = (url, options) => router.visit(url, options);
  const { currentStore, items, sales, customerDebts, expenses, formatCurrency } = useApp();
  const { hasFeature } = useFeatureAccess();

  const totalStock = items.reduce((sum, i) => sum + i.quantity, 0);
  const lowStockItems = items.filter(i => i.type === 'product' && i.quantity > 0 && i.quantity <= i.low_stock_threshold);
  const outOfStockItems = items.filter(i => i.type === 'product' && i.quantity === 0);
  const lowStockCount = lowStockItems.length + outOfStockItems.length;
  const hasInventoryFeature = hasFeature('inventory');
  const todaySales = sales.filter(s => {
    const d = new Date(s.sold_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const openDebts = customerDebts.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.balance_amount, 0);
  const todayExpenses = expenses.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      {/* Mobile-only drawer */}
      <div className="lg:hidden">
        <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>

      {/* Mobile Header - hidden on desktop (sidebar replaces it) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <button onClick={() => setDrawerOpen(true)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
          <Menu size={22} className="text-foreground" />
        </button>
        <h1 className="text-lg font-extrabold text-foreground tracking-tight">Dashboard</h1>
        <div className="w-8" />
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 py-6 border-b border-border bg-card/50">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {currentStore?.store_name}</p>
        </div>
        <button
          onClick={() => {
            if (!hasFeature('pos_sales')) {
              toast.error('This feature is not included in your current plan. Please upgrade.');
              navigate('/upgrade');
              return;
            }
            navigate('/start-sale');
          }}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-2 shadow-md hover:shadow-lg active:scale-[0.97] transition-all"
        >
          <ShoppingCart size={20} />
          Start Sale
        </button>
      </header>

      {/* Content */}
      <div className="px-4 lg:px-8 py-4 lg:py-6 space-y-5 lg:space-y-6 max-w-7xl mx-auto w-full">

        {/* Trial Expiry Warning */}
        <TrialExpiryBanner />

        {/* Onboarding Cards */}
        <OnboardingCards />

        {/* Desktop: Stats row with 4 cards */}
        <div className="hidden lg:grid grid-cols-4 gap-4 animate-fade-in">
          <div className="bg-card rounded-2xl p-5 shadow-sm ring-1 ring-border">
            <p className="text-sm font-medium text-muted-foreground">Today's Sales</p>
            <p className="text-2xl font-extrabold text-primary mt-1">{todaySales.length}</p>
            <p className="text-xs text-muted-foreground mt-1">transactions</p>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-sm ring-1 ring-border">
            <p className="text-sm font-medium text-muted-foreground">Revenue</p>
            <p className="text-2xl font-extrabold text-info mt-1">{formatCurrency(todayRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">earned today</p>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-sm ring-1 ring-border">
            <p className="text-sm font-medium text-muted-foreground">Expenses</p>
            <p className="text-2xl font-extrabold text-destructive mt-1">{formatCurrency(todayExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">spent today</p>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-sm ring-1 ring-border">
            <p className="text-sm font-medium text-muted-foreground">Open Debts</p>
            <p className="text-2xl font-extrabold text-warning mt-1">{formatCurrency(openDebts)}</p>
            <p className="text-xs text-muted-foreground mt-1">outstanding</p>
          </div>
        </div>

        {/* Mobile-only: Store Card */}
        <div
          className="lg:hidden relative overflow-hidden bg-card rounded-2xl shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.12)] ring-1 ring-border animate-fade-in"
          style={{ animationDelay: '0ms' }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="p-4 flex items-center gap-4">
            {currentStore?.logo_url ? (
              <img src={currentStore.logo_url} alt={currentStore.store_name} className="w-14 h-14 rounded-xl object-cover shadow-inner" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center shadow-inner">
                <Store size={26} className="text-warning" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground truncate text-base">{currentStore?.store_name || 'My Store'}</h3>
              <p className="text-sm text-muted-foreground truncate">{currentStore?.location}</p>
              <p className="text-xs text-muted-foreground">{currentStore?.phone}</p>
            </div>
            <button
              onClick={() => navigate('/store-edit')}
              className="p-2.5 rounded-xl bg-accent hover:bg-accent/80 transition-colors"
            >
              <Pencil size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Desktop: Store info + stock alert row */}
        <div className="hidden lg:grid grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl p-5 shadow-sm ring-1 ring-border flex items-center gap-4">
            {currentStore?.logo_url ? (
              <img src={currentStore.logo_url} alt={currentStore.store_name} className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center">
                <Store size={26} className="text-warning" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground truncate">{currentStore?.store_name || 'My Store'}</h3>
              <p className="text-sm text-muted-foreground truncate">{currentStore?.location} · {currentStore?.phone}</p>
              <p className="text-xs text-muted-foreground">Store ID: {currentStore?.store_code}</p>
            </div>
            <button
              onClick={() => navigate('/store-edit')}
              className="p-2.5 rounded-xl bg-accent hover:bg-accent/80 transition-colors"
            >
              <Pencil size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-sm ring-1 ring-border flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inventory</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{items.length} items</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Total Stock</p>
                <p className="text-2xl font-extrabold text-primary mt-1">{totalStock}</p>
              </div>
            </div>
            {hasInventoryFeature && lowStockCount > 0 && (
              <button
                onClick={() => navigate('/inventory')}
                className="mt-3 flex items-center gap-2 text-sm font-semibold text-destructive"
              >
                <Package size={16} />
                {lowStockCount} items low on stock
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile-only: Quick Stats */}
        <div className="lg:hidden grid grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '80ms' }}>
          <div className="bg-card rounded-xl p-3 shadow-sm ring-1 ring-border text-center">
            <p className="text-lg font-extrabold text-primary">{todaySales.length}</p>
            <p className="text-[11px] font-medium text-muted-foreground leading-tight">Sales Today</p>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm ring-1 ring-border text-center">
            <p className="text-lg font-extrabold text-info">{formatCurrency(todayRevenue)}</p>
            <p className="text-[11px] font-medium text-muted-foreground leading-tight">Revenue</p>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm ring-1 ring-border text-center">
            <p className="text-lg font-extrabold text-warning">{formatCurrency(openDebts)}</p>
            <p className="text-[11px] font-medium text-muted-foreground leading-tight">Open Debts</p>
          </div>
        </div>

        {/* Mobile-only: Stock Alert */}
        {hasInventoryFeature && lowStockCount > 0 && (
          <button
            onClick={() => navigate('/inventory')}
            className="lg:hidden w-full flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 animate-fade-in"
            style={{ animationDelay: '120ms' }}
          >
            <div className="flex items-center gap-2">
              <Package size={18} className="text-destructive" />
              <span className="text-sm font-semibold text-destructive">{lowStockCount} items low on stock</span>
            </div>
            <ChevronRight size={16} className="text-destructive" />
          </button>
        )}

        {/* Mobile-only: Start Sale CTA */}
        <button
          onClick={() => {
            if (!hasFeature('pos_sales')) {
              toast.error('This feature is not included in your current plan. Please upgrade.');
              navigate('/upgrade');
              return;
            }
            navigate('/start-sale');
          }}
          className="lg:hidden group w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/85 text-primary-foreground font-bold text-lg flex items-center justify-center gap-3 shadow-[0_6px_20px_-4px_hsl(var(--primary)/0.45)] active:scale-[0.97] hover:shadow-[0_8px_28px_-4px_hsl(var(--primary)/0.55)] transition-all duration-200 animate-fade-in"
          style={{ animationDelay: '160ms' }}
        >
          <ShoppingCart size={24} className="group-hover:rotate-[-8deg] transition-transform duration-200" />
          START SALE
        </button>

        {/* Low Stock Alerts Widget */}
        {hasInventoryFeature && (lowStockItems.length > 0 || outOfStockItems.length > 0) && (
          <div className="bg-card rounded-2xl ring-1 ring-destructive/20 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 lg:px-5 py-3 bg-destructive/5 border-b border-destructive/10">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-destructive" />
                <h3 className="font-bold text-foreground text-sm">Low Stock Alerts</h3>
                <span className="bg-destructive/15 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {lowStockItems.length + outOfStockItems.length}
                </span>
              </div>
              <button onClick={() => navigate('/inventory')} className="text-xs font-semibold text-primary hover:underline">
                View All
              </button>
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/20">
                    <th className="text-left px-5 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Product Name</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Remaining</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Threshold</th>
                    <th className="text-center px-5 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...outOfStockItems, ...lowStockItems].slice(0, 8).map(item => (
                    <tr key={item.id} className="border-b border-border last:border-0 bg-destructive/3 hover:bg-destructive/8 transition-colors">
                      <td className="px-5 py-2.5 text-sm font-semibold text-destructive">{item.name}</td>
                      <td className="px-5 py-2.5 text-sm font-bold text-destructive text-right">{item.quantity}</td>
                      <td className="px-5 py-2.5 text-sm text-muted-foreground text-right">{item.low_stock_threshold}</td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.quantity === 0
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-warning/15 text-warning'
                        }`}>
                          {item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="lg:hidden divide-y divide-border">
              {[...outOfStockItems, ...lowStockItems].slice(0, 5).map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between bg-destructive/3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-destructive truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Threshold: {item.low_stock_threshold}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-destructive">{item.quantity}</p>
                    <span className={`text-[9px] font-bold uppercase ${
                      item.quantity === 0 ? 'text-destructive' : 'text-warning'
                    }`}>
                      {item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid Tiles - responsive: 3 cols mobile, 4 cols tablet, 6 cols desktop */}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">
          {tiles.map((tile, index) => {
            const featureKey = ROUTE_FEATURE_MAP[tile.path] as FeatureKey | undefined;
            const isLocked = featureKey ? !hasFeature(featureKey) : false;
            return (
              <button
                key={tile.label}
                onClick={() => {
                  if (isLocked) {
                    navigate('/upgrade');
                  } else {
                    navigate(tile.path);
                  }
                }}
                className={`${tile.bg} ${tile.ring} ring-1 rounded-2xl p-4 lg:p-5 flex flex-col items-center justify-center gap-2.5 min-h-[110px] lg:min-h-[130px] shadow-sm hover:shadow-md active:scale-[0.93] hover:scale-[1.03] transition-all duration-200 animate-fade-in ${isLocked ? 'opacity-50' : ''}`}
                style={{ animationDelay: `${200 + index * 40}ms` }}
              >
                <div className="relative w-11 h-11 lg:w-13 lg:h-13 rounded-xl bg-card/60 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <tile.icon size={22} className={tile.iconColor} />
                  {isLocked && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <Lock size={10} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] lg:text-xs font-bold text-foreground text-center leading-tight tracking-wide">{tile.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile-only Bottom Nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
