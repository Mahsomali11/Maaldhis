import { useApp } from '@/context/AppContext';
import type { FeatureKey } from '@/lib/features';

export function useFeatureAccess() {
  const { storeFeatures, isLicenseActive, licenseStatus, currentStore } = useApp();

  const hasFeature = (key: FeatureKey): boolean => {
    // Note: License active status is now handled separately by isLicenseActive flag.
    // hasFeature STRICTLY checks if a feature is included in the plan.
    // If we have a license but it's totally unknown (backward compat), allow all
    if (!licenseStatus || licenseStatus.status === 'none' || licenseStatus.plan_name === 'None') {
       if (!storeFeatures || Object.keys(storeFeatures).length === 0) return true;
    }

    // For Dental Clinic stores, dental module features are enabled by default unless explicitly set to false
    if (
      currentStore?.business_type === 'dental_clinic' &&
      (key === 'dental_patients' || key === 'dental_appointments' || key === 'dental_charting' || key === 'dental_billing' || key === 'dental_catalog' || key === 'purchases' || key === 'suppliers')
    ) {
      return storeFeatures?.[key] !== false;
    }
    
    return storeFeatures?.[key] === true;
  };

  return { hasFeature, storeFeatures };
}
