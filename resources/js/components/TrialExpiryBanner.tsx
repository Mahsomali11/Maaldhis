import { useApp } from '@/context/AppContext';
import { AlertTriangle } from 'lucide-react';
import { router, usePage, Link } from '@inertiajs/react';

export default function TrialExpiryBanner() {
  const { licenseStatus } = useApp();
  const navigate = (url, options) => router.visit(url, options);

  if (!licenseStatus || licenseStatus.status !== 'active') return null;
  const days = licenseStatus.days_remaining;
  if (days === undefined || days > 7) return null;

  const urgency = days <= 1 ? 'bg-destructive/15 border-destructive/30 text-destructive' :
                  days <= 3 ? 'bg-warning/15 border-warning/30 text-warning' :
                  'bg-info/15 border-info/30 text-info';

  return (
    <div className={`${urgency} border rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in`}>
      <AlertTriangle size={18} className="shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold">
          {days <= 0 ? 'Your trial has expired!' : `Your trial expires in ${days} day${days === 1 ? '' : 's'}`}
        </p>
        <p className="text-xs opacity-80">Upgrade your plan to continue using the POS system.</p>
      </div>
      <button onClick={() => navigate('/upgrade')}
        className="px-3 py-1.5 rounded-lg bg-foreground/10 text-xs font-bold hover:bg-foreground/20 transition-colors shrink-0">
        Upgrade
      </button>
    </div>
  );
}
