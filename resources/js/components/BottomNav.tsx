import { router, usePage } from '@inertiajs/react';
import { Home, Package, BarChart3, Users, Calendar, Stethoscope } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const retailNavItems = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Inventory', icon: Package, path: '/inventory' },
  { label: 'Sales Report', icon: BarChart3, path: '/sales-report' },
];

const dentalNavItems = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Patients', icon: Users, path: '/patients' },
  { label: 'Appointments', icon: Calendar, path: '/appointments' },
  { label: 'Billing', icon: Stethoscope, path: '/dental-billing' },
];

export default function BottomNav() {
  const navigate = (url, options) => router.visit(url, options);
  const { url } = usePage(); const location = { pathname: url };
  const { currentStore, user } = useApp();
  const role = user?.role || 'owner';
  let navItems = currentStore?.business_type === 'dental_clinic' ? dentalNavItems : retailNavItems;
  if (currentStore?.business_type === 'dental_clinic' && (role === 'receptionist' || role === 'front_desk')) {
    navItems = navItems.filter(item => item.path !== '/dental-billing');
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive ? 'text-info' : 'text-muted-foreground'
              }`}
            >
              <item.icon size={22} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
