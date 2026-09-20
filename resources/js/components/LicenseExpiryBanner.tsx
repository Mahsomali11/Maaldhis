import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface LicenseExpiryBannerProps {
  daysRemaining: number;
  expiryDate?: string;
}

export default function LicenseExpiryBanner({ daysRemaining, expiryDate }: LicenseExpiryBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || daysRemaining > 7 || daysRemaining <= 0) return null;

  const isUrgent = daysRemaining <= 1;
  const isWarning = daysRemaining <= 3;

  const bgClass = isUrgent
    ? 'bg-destructive/15 border-destructive/30 text-destructive'
    : isWarning
    ? 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400'
    : 'bg-yellow-500/15 border-yellow-500/30 text-yellow-700 dark:text-yellow-400';

  const message = isUrgent
    ? `Your license expires tomorrow${expiryDate ? ` (${expiryDate})` : ''}! Renew now to avoid service interruption.`
    : daysRemaining <= 3
    ? `Your license expires in ${daysRemaining} days${expiryDate ? ` (${expiryDate})` : ''}. Please renew to avoid service interruption.`
    : `Your license will expire in ${daysRemaining} days${expiryDate ? ` (${expiryDate})` : ''}. Consider renewing soon.`;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl mb-4 ${bgClass}`}>
      <AlertTriangle size={20} className="shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
}
