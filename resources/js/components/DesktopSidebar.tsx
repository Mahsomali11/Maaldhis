import { router, usePage, Link } from '@inertiajs/react';
import {
  Home, Receipt, TrendingUp, CreditCard, Undo2, Package, BarChart3,
  Users, ArrowLeftRight, Clock, Truck, UserCog, FileText, ShoppingCart,
  Settings, BookOpen, HelpCircle, Store, LogOut, ChevronLeft, ChevronRight, User, Wallet, Lock,
  ChevronsUpDown, Check, Plus, Shield, ChevronDown
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ROUTE_FEATURE_MAP } from '@/lib/features';
import type { FeatureKey } from '@/lib/features';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

const mainNav = [
  { label: 'Dashboard', icon: Home, path: '/dashboard' },
  { label: 'Start Sale', icon: ShoppingCart, path: '/start-sale' },
  { label: 'Inventory', icon: Package, path: '/inventory', subItems: [
      { label: 'Items', path: '/inventory' },
      { label: 'Categories', path: '/categories' }
  ] },
  { label: 'Sales Report', icon: BarChart3, path: '/sales-report' },
];

const moduleNav = [
  { label: 'Expenses', icon: Receipt, path: '/expenses' },
  { label: 'Cash Flow', icon: TrendingUp, path: '/cash-flow' },
  { label: 'Credit Record', icon: CreditCard, path: '/credit-record' },
  { label: 'Returns', icon: Undo2, path: '/returns' },
  { label: 'Customers', icon: Users, path: '/customers' },
  { label: 'Suppliers', icon: Truck, path: '/suppliers' },
  { label: 'Stock Transfers', icon: ArrowLeftRight, path: '/stock-transfers' },
  { label: 'Receipt History', icon: Clock, path: '/receipt-history' },
  { label: 'Staff Accounts', icon: UserCog, path: '/staff-accounts' },
  { label: 'Stock Report', icon: FileText, path: '/stock-report' },
];

const bottomNav = [
  { label: 'My Profile', icon: User, path: '/profile' },
  { label: 'Payment Accounts', icon: Wallet, path: '/payment-accounts' },
  { label: 'Preferences', icon: Settings, path: '/preferences' },
  { label: 'Learning Center', icon: BookOpen, path: '/learning-center' },
  { label: 'Help', icon: HelpCircle, path: '/help' },
];

export default function DesktopSidebar() {
  const navigate = (url, options) => router.visit(url, options);
  const { url } = usePage(); const location = { pathname: url };
  const { currentStore, stores, setCurrentStore, user, logout } = useApp();
  const { hasFeature } = useFeatureAccess();
  const [collapsed, setCollapsed] = useState(false);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const role = user?.role || 'owner';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStoreDropdownOpen(false);
      }
    };
    if (storeDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [storeDropdownOpen]);

  const isActive = (path: string) => location.pathname === path;

  // Filter navigation items based on role
  const isItemVisible = (path: string) => {
    if (role === 'owner' || role === 'admin') return true;
    
    if (role === 'cashier') {
      const allowedPaths = ['/dashboard', '/start-sale', '/receipt-history', '/returns', '/customers', '/profile', '/help'];
      return allowedPaths.includes(path);
    }
    
    if (role === 'inventory_manager') {
      const allowedPaths = ['/dashboard', '/inventory', '/stock-transfers', '/suppliers', '/stock-report', '/profile', '/help'];
      return allowedPaths.includes(path);
    }
    
    return false;
  };

  const filteredMainNav = mainNav.filter(item => isItemVisible(item.path));
  const filteredModuleNav = moduleNav.filter(item => isItemVisible(item.path));
  const filteredBottomNav = bottomNav.filter(item => isItemVisible(item.path));

  const NavItem = ({ label, icon: Icon, path, subItems }: { label: string; icon: any; path: string; subItems?: any[] }) => {
    const featureKey = ROUTE_FEATURE_MAP[path] as FeatureKey | undefined;
    const isLocked = featureKey ? !hasFeature(featureKey) : false;
    const hasSubItems = subItems && subItems.length > 0;
    const isSubItemActive = hasSubItems && subItems.some(s => isActive(s.path));
    const active = isActive(path) || isSubItemActive;
    const isOpen = hasSubItems && (inventoryOpen || isSubItemActive);

    return (
      <div className="w-full">
        <button
          onClick={() => {
            if (isLocked) {
              toast.error('This feature is not included in your current plan. Please upgrade.');
              navigate('/upgrade');
            } else if (hasSubItems && !collapsed) {
              setInventoryOpen(!inventoryOpen);
            } else {
              navigate(path);
            }
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
            isLocked
              ? 'text-muted-foreground/50 cursor-not-allowed'
              : active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
          title={collapsed ? label + (isLocked ? ' 🔒' : '') : undefined}
        >
          <Icon size={20} className={`shrink-0 ${isLocked ? 'text-muted-foreground/40' : active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-left">{label}</span>
              {hasSubItems && <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
            </>
          )}
          {!collapsed && isLocked && <Lock size={14} className="text-muted-foreground/50 shrink-0" />}
        </button>
        
        {/* Sub Items */}
        {hasSubItems && isOpen && !collapsed && !isLocked && (
          <div className="pl-9 pr-3 py-1 mt-1 space-y-1">
            {subItems.map((subItem) => (
              <button
                key={subItem.path}
                onClick={() => navigate(subItem.path)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive(subItem.path)
                    ? 'text-primary font-medium bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {subItem.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen sticky top-0 bg-card border-r border-border transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Store Header */}
      <div className="p-4 border-b border-border relative" ref={dropdownRef}>
        {!collapsed ? (
          <button
            onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Store size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-foreground text-sm truncate">{currentStore?.store_name || 'My Store'}</h3>
              <p className="text-xs text-muted-foreground truncate">{user?.full_name}</p>
            </div>
            <ChevronsUpDown size={16} className="text-muted-foreground shrink-0" />
          </button>
        ) : (
          <button
            onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
            className="w-full flex justify-center p-1 rounded-xl hover:bg-accent transition-colors"
            title={currentStore?.store_name || 'Switch Store'}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store size={20} className="text-primary" />
            </div>
          </button>
        )}

        {/* Dropdown */}
        {storeDropdownOpen && (
          <div className={`absolute z-50 top-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden ${collapsed ? 'left-2 w-56' : 'left-4 right-4'}`}>
            <div className="p-1.5 max-h-60 overflow-y-auto">
              {stores.map(store => (
                <button
                  key={store.id}
                  onClick={() => {
                    setCurrentStore(store);
                    setStoreDropdownOpen(false);
                    navigate('/dashboard');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    store.id === currentStore?.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-accent'
                  }`}
                >
                  <Store size={16} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium text-sm">{store.store_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{store.location}</p>
                  </div>
                  {store.id === currentStore?.id && <Check size={16} className="shrink-0 text-primary" />}
                </button>
              ))}
            </div>
            <div className="border-t border-border p-1.5">
              <button
                onClick={() => {
                  setStoreDropdownOpen(false);
                  navigate('/create-store');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus size={16} />
                <span>Add New Store</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Main */}
        <div className="space-y-1">
          {!collapsed && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Main</p>}
          {filteredMainNav.map(item => <NavItem key={item.path} {...item} />)}
        </div>

        {/* Modules */}
        <div className="space-y-1">
          {!collapsed && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Modules</p>}
          {filteredModuleNav.map(item => <NavItem key={item.path} {...item} />)}
        </div>

        {/* Settings */}
        <div className="space-y-1">
          {!collapsed && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Settings</p>}
          {filteredBottomNav.map(item => <NavItem key={item.path} {...item} />)}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={20} className="shrink-0" /> : <ChevronLeft size={20} className="shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
