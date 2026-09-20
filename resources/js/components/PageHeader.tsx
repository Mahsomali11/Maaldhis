import { forwardRef } from 'react';
import { router, usePage, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: ReactNode;
}

const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(({ title, showBack = false, rightAction }, ref) => {
  const navigate = (url, options) => router.visit(url, options);

  return (
    <header ref={ref} className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
      {showBack && (
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft size={24} className="text-foreground" />
        </button>
      )}
      <h1 className="text-lg font-bold text-foreground flex-1">{title}</h1>
      {rightAction}
    </header>
  );
});

PageHeader.displayName = 'PageHeader';

export default PageHeader;
