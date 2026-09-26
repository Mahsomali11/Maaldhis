import { Link } from '@inertiajs/react';
import { ArrowRight, ShoppingBag } from 'lucide-react';

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] dark:bg-background p-4 relative overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-3xl opacity-50"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="text-center relative z-10 max-w-lg w-full bg-card rounded-3xl border border-border p-8 md:p-12 shadow-2xl animate-in zoom-in-95 duration-500">
        
        <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-8 shadow-xl shadow-primary/20 ring-8 ring-primary/10">
           <ShoppingBag size={48} className="text-primary-foreground" />
        </div>
        
        <h1 className="mb-4 text-4xl md:text-5xl font-black text-foreground tracking-tight">Maaldhis POS</h1>
        <p className="mb-10 text-lg font-medium text-muted-foreground leading-relaxed">
          The all-in-one point of sale system for modern businesses. Simplify your operations, track inventory, and grow your sales.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
           <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-black text-base flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg hover:shadow-xl">
             Get Started <ArrowRight size={18} />
           </Link>
           <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-card border-2 border-border text-foreground font-black text-base flex items-center justify-center hover:bg-muted hover:border-primary/30 active:scale-[0.98] transition-all shadow-sm">
             Sign In
           </Link>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 w-full text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
         © {new Date().getFullYear()} Maaldhis
      </div>
    </div>
  );
};

export default Index;
