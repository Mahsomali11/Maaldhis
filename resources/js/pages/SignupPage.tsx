import { useState, useEffect } from 'react';
import { Store, User, MapPin, DollarSign, Mail, Lock, CheckCircle2, MapPinned } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import PhoneInput, { COUNTRY_CODES, useGeoCountry, getInternationalPhone, type CountryCode } from '@/components/PhoneInput';
import { useForm, Head, Link } from '@inertiajs/react';
import { toast } from 'sonner';

const CURRENCIES = ['KSh', 'USD', 'EUR', 'GBP', 'TZS', 'UGX', 'ETB', 'SSP', 'RWF', 'BIF'];

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 2;

  const { data, setData, post, processing, errors, clearErrors } = useForm({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    storePhone: '',
    storeLocation: '',
    currency: 'KSh',
  });

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [phoneError, setPhoneError] = useState('');

  const { detect, detecting } = useGeoCountry((country) => {
    setSelectedCountry(country);
    toast.success(`Country detected: ${country.country} (${country.dialCode})`);
  });

  useEffect(() => {
    detect();
  }, []);

  const validateStep1 = () => {
    clearErrors();
    let valid = true;
    if (!data.fullName.trim()) { setData('fullName', data.fullName); valid = false; }
    if (!data.email.trim()) { valid = false; }
    if (data.password.length < 6) { valid = false; }
    if (data.password !== data.confirmPassword) { valid = false; }
    return valid;
  };

  const validateStep2 = () => {
    clearErrors();
    if (!data.storeName.trim()) return false;
    if (data.storePhone && data.storePhone.length !== selectedCountry.phoneLength) {
      setPhoneError(`Phone number must contain exactly ${selectedCountry.phoneLength} digits for ${selectedCountry.country}.`);
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
  };

  const handleBack = () => {
    clearErrors();
    setPhoneError('');
    setStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    const internationalPhone = data.storePhone ? getInternationalPhone(selectedCountry, data.storePhone) : '';
    
    // Convert to the shape the controller expects
    setData('storePhone', internationalPhone);
    
    post('/signup-with-store', {
        onSuccess: () => {
            toast.success('Account created! Your store is ready.');
        }
    });
  };

  const inputClass = "w-full px-4 py-3.5 rounded-xl border-2 border-input bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Head title="Create Account" />
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
      </div>
      <div className="flex-1 bg-card rounded-t-2xl px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Step {step} of {totalSteps}</span>
            <span className="text-xs font-semibold text-primary">{Math.round((step / totalSteps) * 100)}%</span>
          </div>
          <Progress value={(step / totalSteps) * 100} className="h-2" />
        </div>

        {step === 1 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <User size={20} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Your Information</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Tell us about yourself</p>

            <div className="flex flex-col gap-4">
              {errors.email && <p className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">{errors.email}</p>}
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={data.fullName} onChange={e => setData('fullName', e.target.value)} placeholder="Full name *"
                  className={`${inputClass} pl-10`} required />
              </div>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={data.email} onChange={e => setData('email', e.target.value)} placeholder="Email address *"
                  className={`${inputClass} pl-10`} required />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={data.password} onChange={e => setData('password', e.target.value)} placeholder="Password (min 6 characters) *"
                  className={`${inputClass} pl-10`} required />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={data.confirmPassword} onChange={e => setData('confirmPassword', e.target.value)} placeholder="Confirm password *"
                  className={`${inputClass} pl-10`} required />
              </div>
              <button type="button" onClick={handleNext}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base mt-2 active:scale-[0.98] transition-transform">
                Next — Store Details
              </button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-info underline font-medium">Sign in</Link>
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <Store size={20} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Store Information</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Set up your first store</p>

            <div className="flex flex-col gap-4">
              {errors.storeName && <p className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">{errors.storeName}</p>}
              <div className="relative">
                <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={data.storeName} onChange={e => setData('storeName', e.target.value)} placeholder="Store name *"
                  className={`${inputClass} pl-10`} required />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Business Phone Number</label>
                {detecting && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <MapPinned size={14} className="animate-pulse text-primary" />
                    <span>Detecting your country...</span>
                  </div>
                )}
                <PhoneInput
                  value={data.storePhone}
                  onChange={(digits) => { setData('storePhone', digits); setPhoneError(''); }}
                  selectedCountry={selectedCountry}
                  onCountryChange={setSelectedCountry}
                  error={phoneError}
                />
              </div>

              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={data.storeLocation} onChange={e => setData('storeLocation', e.target.value)} placeholder="Store location / address"
                  className={`${inputClass} pl-10`} />
              </div>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select value={data.currency} onChange={e => setData('currency', e.target.value)}
                  className={`${inputClass} pl-10`}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 size={20} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">14-day free trial included</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Full access to all POS features. No credit card required.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={handleBack}
                  className="flex-1 py-3.5 rounded-xl border-2 border-border text-foreground font-bold text-base active:scale-[0.98] transition-transform">
                  Back
                </button>
                <button type="submit" disabled={processing}
                  className="flex-[2] py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50">
                  {processing ? 'Creating...' : 'Create Account & Store'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
