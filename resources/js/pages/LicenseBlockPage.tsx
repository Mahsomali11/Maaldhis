import { useApp } from '@/context/AppContext';
import { router } from '@inertiajs/react';
import { AlertTriangle, Shield, RefreshCw, Crown, MessageCircle, LogOut } from 'lucide-react';

export default function LicenseBlockPage() {
  const { currentStore, licenseStatus, logout } = useApp();
  const navigate = (url, options) => router.visit(url, options);

  const statusMessages: Record<string, { title: string; message: string; color: string }> = {
    expired: {
      title: 'License Expired',
      message: 'Your license has expired. Renew your subscription to continue using Nasri Point.',
      color: 'hsl(35,90%,50%)',
    },
    suspended: {
      title: 'License Suspended',
      message: 'Your store license has been suspended by the platform administrator. Please contact support.',
      color: 'hsl(0,72%,51%)',
    },
    cancelled: {
      title: 'License Cancelled',
      message: 'Your store license has been cancelled. Please contact support for assistance.',
      color: 'hsl(0,72%,51%)',
    },
    inactive: {
      title: 'License Inactive',
      message: 'Your license is inactive. Please renew your subscription to continue using the system.',
      color: 'hsl(35,90%,50%)',
    },
  };

  const status = licenseStatus?.status || 'expired';
  const info = statusMessages[status] || statusMessages.expired;

  // Check if expired by days_remaining
  const isExpired = status === 'expired' || (licenseStatus?.days_remaining !== undefined && licenseStatus.days_remaining < 0);
  const displayInfo = isExpired ? statusMessages.expired : info;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: `${displayInfo.color}20` }}>
          {status === 'suspended' ? (
            <Shield size={40} style={{ color: displayInfo.color }} />
          ) : (
            <AlertTriangle size={40} style={{ color: displayInfo.color }} />
          )}
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">{displayInfo.title}</h1>
        <p className="text-muted-foreground mb-4">{displayInfo.message}</p>

        {currentStore && (
          <div className="bg-card rounded-xl p-4 border border-border mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Store</span>
              <span className="text-foreground font-medium">{currentStore.store_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize" style={{ color: displayInfo.color }}>
                {isExpired ? 'Expired' : status}
              </span>
            </div>
            {licenseStatus?.expiry_date && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expiry Date</span>
                <span className="text-foreground">{licenseStatus.expiry_date}</span>
              </div>
            )}
            {licenseStatus?.plan_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="text-foreground">{licenseStatus.plan_name}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Crown size={18} /> Renew License
          </button>
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full py-3 rounded-xl bg-accent text-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Crown size={18} /> View Plans
          </button>
          <button
            onClick={() => navigate('/help')}
            className="w-full py-3 rounded-xl bg-accent text-foreground font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} /> Contact Support
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-muted text-foreground font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} /> Check Again
          </button>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-medium flex items-center justify-center gap-2"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Need help? Contact support for assistance with your subscription.
        </p>
      </div>
    </div>
  );
}
