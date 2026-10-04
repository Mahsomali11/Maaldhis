import { useApp } from '@/context/AppContext';
import type { FeatureKey } from '@/lib/features';

export function useFeatureAccess() {
  const { storeFeatures, isLicenseActive } = useApp();

  const hasFeature = (key: FeatureKey): boolean => {
    // If license is not active, block all features
    if (!isLicenseActive) return false;
    // No features configured = allow all (no license system yet)
    if (!storeFeatures || Object.keys(storeFeatures).length === 0) return true;
    return storeFeatures[key] === true;
  };

  return { hasFeature, storeFeatures };
}
