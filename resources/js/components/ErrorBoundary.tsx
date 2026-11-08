import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WifiOff, AlertTriangle, RefreshCw, ShoppingCart, LayoutDashboard, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught unhandled rendering exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoDashboard = () => {
    window.location.href = '/dashboard';
  };

  private handleGoPos = () => {
    window.location.href = '/start-sale';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isOffline =
        typeof navigator !== 'undefined' &&
        (!navigator.onLine ||
          this.state.error?.message?.includes('fetch') ||
          this.state.error?.message?.includes('network') ||
          this.state.error?.message?.includes('NetworkError') ||
          this.state.error?.message?.includes('chunk'));

      return (
        <div className="min-h-[500px] w-full flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-5">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${isOffline ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {isOffline ? <WifiOff size={28} /> : <AlertTriangle size={28} />}
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">
                {isOffline ? 'Working in Offline Mode' : 'Something went wrong'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isOffline
                  ? 'A view transition was interrupted while disconnected. All local records, offline sales, and charts remain safely preserved in local storage.'
                  : (this.state.error?.message || 'An unexpected error occurred while rendering this view.')}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <RefreshCw size={15} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors border border-border/60"
              >
                <span>Try Again</span>
              </button>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={this.handleGoPos}
                className="hover:text-primary transition-colors inline-flex items-center gap-1 font-medium"
              >
                <ShoppingCart size={13} />
                <span>Open POS</span>
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="hover:text-primary transition-colors inline-flex items-center gap-1 font-medium"
              >
                <LayoutDashboard size={13} />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

