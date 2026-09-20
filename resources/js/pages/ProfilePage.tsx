import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { User, Phone, Mail, Lock, Shield, Store, Crown, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { router } from '@inertiajs/react';

export default function ProfilePage() {
  const { user, profile, currentStore, licenseStatus, updateProfile, changePassword, logout } = useApp();
  const navigate = (url, options) => router.visit(url, options);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    const success = await updateProfile({ full_name: fullName, phone });
    if (success) {
      toast.success('Profile updated successfully');
    } else {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    const success = await changePassword(newPassword);
    if (success) {
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error('Failed to change password');
    }
    setChangingPassword(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <PageHeader title="My Profile" />

      <div className="px-4 lg:px-8 py-4 lg:py-6 max-w-2xl mx-auto space-y-5">

        {/* Avatar & Name Header */}
        <div className="bg-card rounded-2xl p-5 border border-border flex items-center gap-4">
          {currentStore?.logo_url ? (
            <img src={currentStore.logo_url} alt={currentStore.store_name} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <User size={32} className="text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground truncate">{profile?.full_name || 'User'}</h2>
            <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
            {licenseStatus?.plan_name && (
              <div className="flex items-center gap-1.5 mt-1">
                <Crown size={14} className="text-warning" />
                <span className="text-xs font-semibold text-warning capitalize">{licenseStatus.plan_name} Plan</span>
              </div>
            )}
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <User size={18} className="text-primary" />
            Personal Information
          </h3>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Full Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Your full name"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Phone</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Phone number"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={profile?.email || ''}
                disabled
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-muted/50 text-muted-foreground text-sm cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Change Password */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Lock size={18} className="text-primary" />
            Change Password
          </h3>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">New Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-input bg-accent/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="New password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Confirm Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword}
            className="w-full py-3 rounded-xl bg-foreground/10 text-foreground font-bold hover:bg-foreground/15 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </div>

        {/* Account Info */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Shield size={18} className="text-primary" />
            Account Details
          </h3>

          {currentStore && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store size={16} />
                Store
              </div>
              <span className="text-sm font-semibold text-foreground">{currentStore.store_name}</span>
            </div>
          )}

          {licenseStatus && licenseStatus.status !== 'none' && (
            <>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm text-muted-foreground">License Status</span>
                <span className={`text-sm font-semibold capitalize ${
                  licenseStatus.status === 'active' ? 'text-primary' : 'text-destructive'
                }`}>
                  {licenseStatus.status}
                </span>
              </div>
              {licenseStatus.expiry_date && (
                <div className="flex items-center justify-between py-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className="text-sm font-semibold text-foreground">{licenseStatus.expiry_date}</span>
                </div>
              )}
              <button
                onClick={() => navigate('/upgrade')}
                className="w-full py-2.5 rounded-xl bg-warning/10 text-warning font-bold text-sm hover:bg-warning/15 transition-colors flex items-center justify-center gap-2"
              >
                <Crown size={16} />
                {licenseStatus.days_remaining !== undefined && licenseStatus.days_remaining <= 7 ? 'Renew / Upgrade Plan' : 'Upgrade Plan'}
              </button>
            </>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full py-3 rounded-xl bg-destructive/10 text-destructive font-bold hover:bg-destructive/15 active:scale-[0.98] transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
