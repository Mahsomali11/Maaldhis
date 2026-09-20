import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { api as apiClient } from '@/api';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { Crown, Check, Zap, Shield, Star, Loader2, Smartphone, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  max_users: number;
  max_devices: number;
  max_stores: number;
  features: any;
  storage_limit: number;
  is_active: boolean;
}

export default function UpgradePage() {
  const navigate = (url, options) => router.visit(url, options);
  const { currentStore, licenseStatus, currency } = useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'mpesa'>('manual');
  const [mpesaEnabled, setMpesaEnabled] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [stkPending, setStkPending] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<{ rate_to_usd: number; currency_symbol: string } | null>(null);

  // Convert USD amount to local currency
  const convertFromUsd = (usdAmount: number): number => {
    if (!exchangeRate || exchangeRate.rate_to_usd === 0 || exchangeRate.rate_to_usd === 1) return usdAmount;
    return Math.round(usdAmount / exchangeRate.rate_to_usd);
  };

  const formatLocalPrice = (usdAmount: number): string => {
    const localAmount = convertFromUsd(usdAmount);
    const symbol = exchangeRate?.currency_symbol || currency || '$';
    return `${symbol}${localAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    // Load plans
    apiClient
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('monthly_price', { ascending: true })
      .then(({ data }) => {
        const filtered = (data || []).filter((p: any) => p.name.toLowerCase() !== 'trial');
        setPlans(filtered as unknown as Plan[]);
        setLoading(false);
      });

    // Check if M-Pesa is enabled platform-wide
    apiClient
      .from('payment_integrations')
      .select('is_enabled, status')
      .eq('provider_name', 'mpesa_platform')
      .eq('is_enabled', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.is_enabled && data.status === 'connected') {
          setMpesaEnabled(true);
        }
      });

    // Load exchange rate for the store's currency
    const storeCurrency = currentStore?.currency || 'KSh';
    apiClient
      .from('exchange_rates')
      .select('rate_to_usd, currency_symbol, currency_code')
      .eq('currency_symbol', storeCurrency)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExchangeRate({ rate_to_usd: Number(data.rate_to_usd), currency_symbol: data.currency_symbol });
        }
      });
  }, [currentStore?.currency]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlan || !currentStore) return;
    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan) return;

    if (paymentMethod === 'mpesa') {
      if (!mpesaPhone || mpesaPhone.length < 10) {
        toast.error('Please enter a valid phone number');
        return;
      }
      await handleMpesaPayment(plan);
      return;
    }

    setProcessing(true);
    try {
      const price = billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price;
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (billingCycle === 'monthly' ? 1 : 12));

      const { error: subError } = await apiClient.from('subscriptions').insert({
        store_id: currentStore.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        start_date: startDate,
        end_date: endDate.toISOString().split('T')[0],
        status: 'pending',
      } as any);
      if (subError) throw subError;

      const { error: payError } = await apiClient.from('platform_payments').insert({
        store_id: currentStore.id,
        amount: price,
        method: 'manual',
        status: 'pending',
        transaction_reference: `UP-${Date.now()}`,
        next_due_date: endDate.toISOString().split('T')[0],
      } as any);
      if (payError) throw payError;

      toast.success('Subscription request submitted! The admin will activate your license after payment confirmation.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to process upgrade');
    } finally {
      setProcessing(false);
    }
  };

  const handleMpesaPayment = async (plan: Plan) => {
    setStkPending(true);
    try {
      const price = billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price;

      // Format phone: ensure 254 prefix
      let phone = mpesaPhone.replace(/\s+/g, '');
      if (phone.startsWith('0')) phone = '254' + phone.slice(1);
      if (!phone.startsWith('254')) phone = '254' + phone;

      const { data, error } = await apiClient.functions.invoke('mpesa-stk-push', {
        body: {
          store_id: currentStore!.id,
          phone_number: phone,
          amount: price,
          account_reference: `License-${plan.name}`,
          sale_id: null,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'M-Pesa payment request failed. Please try again.');
        setStkPending(false);
        return;
      }

      toast.success('STK Push sent! Please check your phone and enter your M-Pesa PIN.');

      // Create pending subscription + payment
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (billingCycle === 'monthly' ? 1 : 12));

      await apiClient.from('subscriptions').insert({
        store_id: currentStore!.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        start_date: startDate,
        end_date: endDate.toISOString().split('T')[0],
        status: 'pending',
      } as any);

      await apiClient.from('platform_payments').insert({
        store_id: currentStore!.id,
        amount: price,
        method: 'mpesa',
        status: 'pending',
        transaction_reference: data.checkout_request_id || `MPESA-${Date.now()}`,
        next_due_date: endDate.toISOString().split('T')[0],
      } as any);

      toast.info('Your payment is being processed. You will be notified once confirmed.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'M-Pesa payment failed');
    } finally {
      setStkPending(false);
    }
  };

  const planIcons = [Zap, Star, Crown, Shield];
  const currentPlanName = licenseStatus?.plan_name?.toLowerCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 lg:pb-0">
        <PageHeader title="Upgrade Plan" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <PageHeader title="Upgrade Plan" />

      <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-5xl mx-auto space-y-6">
        {/* Current plan info */}
        {licenseStatus && licenseStatus.status !== 'none' && (
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Current Plan: <span className="text-primary capitalize">{licenseStatus.plan_name || 'Trial'}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {licenseStatus.days_remaining !== undefined && licenseStatus.days_remaining >= 0
                    ? `${licenseStatus.days_remaining} days remaining`
                    : 'Expired'}
                  {licenseStatus.expiry_date && ` · Expires ${licenseStatus.expiry_date}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-accent text-muted-foreground hover:bg-accent/80'}`}>
            Monthly
          </button>
          <button onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${billingCycle === 'yearly' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-accent text-muted-foreground hover:bg-accent/80'}`}>
            Yearly
            <span className="ml-1.5 text-xs opacity-80">Save 20%</span>
          </button>
        </div>

        {/* Plans grid */}
        {plans.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No plans available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan, index) => {
              const Icon = planIcons[index % planIcons.length];
              const price = billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price;
              const isCurrentPlan = currentPlanName === plan.name.toLowerCase();
              const isSelected = selectedPlan === plan.id;
              const canRenew = isCurrentPlan && licenseStatus && (licenseStatus.days_remaining !== undefined && licenseStatus.days_remaining <= 7);
              const features = Array.isArray(plan.features) ? plan.features : [];

              return (
                <div key={plan.id}
                  onClick={() => (canRenew || !isCurrentPlan) && handleSelectPlan(plan.id)}
                  className={`relative rounded-2xl p-5 border-2 transition-all cursor-pointer ${
                    isSelected ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20'
                    : isCurrentPlan && !canRenew ? 'border-primary/30 bg-primary/5 opacity-70 cursor-not-allowed'
                    : isCurrentPlan && canRenew ? 'border-warning bg-warning/5 hover:border-warning/80 hover:shadow-md'
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-md'
                  }`}>
                  {isCurrentPlan && (
                    <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${canRenew ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>
                      {canRenew ? 'Renew' : 'Current'}
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check size={14} className="text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon size={22} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground">{plan.max_users} users · {plan.max_devices} devices · {plan.max_stores} stores</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-foreground">{formatLocalPrice(price)}</span>
                    <span className="text-sm text-muted-foreground ml-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  {features.length > 0 && (
                    <ul className="space-y-2">
                      {features.map((feature: string, fi: number) => (
                        <li key={fi} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check size={14} className="text-primary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Payment section */}
        {selectedPlan && (
          <div className="bg-card rounded-2xl p-5 border border-border space-y-4 animate-fade-in">
            <h3 className="font-bold text-foreground text-lg">
              {currentPlanName === plans.find(p => p.id === selectedPlan)?.name.toLowerCase() ? 'Renew Plan' : 'Upgrade Plan'}
            </h3>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Payment Method</p>
              <div className="flex gap-3">
                <button onClick={() => setPaymentMethod('manual')}
                  className={`flex-1 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                    paymentMethod === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground'
                  }`}>
                  <Crown size={18} />
                  Manual Payment
                </button>
                {mpesaEnabled && (
                  <button onClick={() => setPaymentMethod('mpesa')}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                      paymentMethod === 'mpesa' ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground'
                    }`}>
                    <Smartphone size={18} />
                    M-Pesa
                  </button>
                )}
              </div>
            </div>

            {/* M-Pesa Phone Input */}
            {paymentMethod === 'mpesa' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">M-Pesa Phone Number</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={mpesaPhone}
                    onChange={e => setMpesaPhone(e.target.value)}
                    placeholder="e.g. 0712345678 or 254712345678"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">You will receive an STK Push on this number to complete payment.</p>
              </div>
            )}

            {paymentMethod === 'manual' && (
              <p className="text-sm text-muted-foreground">
                After submitting, the platform administrator will review and activate your license once payment is confirmed.
              </p>
            )}

            <div className="bg-accent/30 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-semibold text-foreground">{plans.find(p => p.id === selectedPlan)?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billing</span>
                <span className="font-semibold text-foreground capitalize">{billingCycle}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-semibold text-foreground capitalize">{paymentMethod === 'mpesa' ? 'M-Pesa' : 'Manual'}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-extrabold text-primary text-lg">
                  {formatLocalPrice(
                    billingCycle === 'monthly'
                      ? plans.find(p => p.id === selectedPlan)?.monthly_price || 0
                      : plans.find(p => p.id === selectedPlan)?.yearly_price || 0
                  )}
                </span>
              </div>
            </div>

            <button onClick={handleProceedToPayment} disabled={processing || stkPending}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.97] transition-all disabled:opacity-50">
              {processing || stkPending ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {stkPending ? 'Sending STK Push...' : 'Processing...'}
                </>
              ) : paymentMethod === 'mpesa' ? (
                <>
                  <Smartphone size={20} />
                  Pay with M-Pesa
                </>
              ) : (
                <>
                  <Crown size={20} />
                  {currentPlanName === plans.find(p => p.id === selectedPlan)?.name.toLowerCase() ? 'Submit Renewal Request' : 'Submit Upgrade Request'}
                </>
              )}
            </button>

            {paymentMethod === 'manual' && (
              <p className="text-xs text-center text-muted-foreground">
                Contact the administrator for payment details (M-Pesa, bank transfer, etc.)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
