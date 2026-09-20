import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = (url, options) => router.visit(url, options);

  useEffect(() => {
    // Check if this is a recovery redirect
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
  }, []);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await apiClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setSent(true);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setMessage('Password must be at least 6 characters'); return; }
    setLoading(true);
    const { error } = await apiClient.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Password updated successfully!');
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader title="Reset Password" />
      <div className="flex-1 bg-card rounded-t-2xl px-6 py-8">
        {isRecovery ? (
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
            <p className="text-muted-foreground mb-2">Enter your new password.</p>
            {message && <p className="text-sm text-info">{message}</p>}
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password"
              className="w-full px-4 py-4 rounded-lg border-2 border-info bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" required />
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        ) : sent ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-foreground mb-2">Reset link sent!</p>
            <p className="text-muted-foreground mb-6">Check your email for the password reset link.</p>
            <button onClick={() => navigate('/login')} className="text-info underline font-medium">Back to Login</button>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-6">Enter your email address and we'll send you a link to reset your password.</p>
            {message && <p className="text-destructive text-sm mb-4">{message}</p>}
            <form onSubmit={handleSendReset} className="flex flex-col gap-5">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email address"
                className="w-full px-4 py-4 rounded-lg border-2 border-info bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" required />
              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
