import { ReactNode } from 'react';
import DesktopSidebar from './DesktopSidebar';
import LicenseExpiryBanner from './LicenseExpiryBanner';
import { useApp } from '@/context/AppContext';

interface DesktopLayoutProps {
  children: ReactNode;
}

export default function DesktopLayout({ children }: DesktopLayoutProps) {
  const { licenseStatus } = useApp();
  const daysRemaining = licenseStatus?.days_remaining ?? 999;

  return (
    <div className="flex min-h-screen w-full">
      <DesktopSidebar />
      <main className="flex-1 min-w-0 transition-all duration-300">
        {licenseStatus?.status === 'active' && daysRemaining <= 7 && (
          <div className="px-4 pt-4">
            <LicenseExpiryBanner
              daysRemaining={daysRemaining}
              expiryDate={licenseStatus.expiry_date}
            />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
