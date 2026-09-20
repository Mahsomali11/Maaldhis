import { Store as StoreIcon } from 'lucide-react';
import { useForm, Head, Link } from '@inertiajs/react';

export default function LoginPage() {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
    remember: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Head title="Sign In" />
      <div className="px-4 py-4">
        <h1 className="text-2xl font-bold text-foreground">Welcome to Nasri Point</h1>
      </div>
      
      <div className="flex-1 bg-card rounded-t-2xl px-6 py-8 flex flex-col">
        <div className="flex justify-center mb-8">
          <div className="w-32 h-32 rounded-full bg-drawer-header flex items-center justify-center">
            <div className="text-center">
              <StoreIcon size={48} className="mx-auto text-card mb-1" />
              <span className="text-xs font-bold text-primary tracking-wider">NASRI POINT</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
          {errors.email && <p className="text-destructive text-sm text-center">{errors.email}</p>}
          
          <div className="relative">
            <input
              type="email"
              value={data.email}
              onChange={e => setData('email', e.target.value)}
              className="w-full px-4 py-4 rounded-lg border-2 border-info bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              placeholder="Enter email address"
              required
            />
          </div>

          <div className="relative">
            <input
              type="password"
              value={data.password}
              onChange={e => setData('password', e.target.value)}
              className="w-full px-4 py-4 rounded-lg border-2 border-primary bg-accent/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              placeholder="Enter password"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={data.remember}
                onChange={e => setData('remember', e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              Remember password
            </label>
            <Link href="/reset-password" className="text-sm text-info underline">
              Forgot password
            </Link>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg mt-4 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {processing ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account?{' '}
            <Link href="/signup" className="text-info underline font-medium">
              Create an account
            </Link>
          </p>

          <div className="mt-6 pt-6 border-t border-border">
            <Link 
              href="/admin/login" 
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-foreground font-medium text-sm hover:bg-accent/80 transition-colors"
            >
              Access Admin Panel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
