import { router } from '@inertiajs/react';
import { useApp } from '@/context/AppContext';
import { Check, Printer, Share2, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { printReceipt, shareReceipt, type ReceiptFormat } from '@/lib/receipt-printer';
import { toast } from 'sonner';

export default function ReceiptPage({ saleId }: { saleId?: string }) {
  const { sales, saleItems, customers, payments, currentStore, formatCurrency, user } = useApp();
  const navigate = (url: string) => router.visit(url);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [printAction, setPrintAction] = useState<'print' | 'download'>('print');

  const sale = sales.find(s => s.id === saleId);
  if (!sale) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Receipt not found</div>;

  const items = saleItems.filter(si => si.sale_id === sale.id);
  const customer = sale.customer_id ? customers.find(c => c.id === sale.customer_id) : null;

  const salePayment = payments.find(p => p.sale_id === sale.id && p.payment_type === 'sale');
  const paymentMethod = salePayment ? salePayment.method : sale.sale_type;

  const receiptData = {
    sale,
    items,
    customer: customer || null,
    store: currentStore!,
    cashierName: user?.full_name || '',
    formatCurrency,
    paymentMethod,
  };

  const handlePrint = (format: ReceiptFormat) => {
    printReceipt(receiptData, format);
    setShowFormatPicker(false);
    toast.success('Print dialog opened');
  };

  const handleShare = async () => {
    const result = await shareReceipt(receiptData);
    if (result === 'copied') toast.success('Receipt copied to clipboard!');
  };

  const openFormatPicker = (action: 'print' | 'download') => {
    setPrintAction(action);
    setShowFormatPicker(true);
  };

  const storeLogo = currentStore?.logo_url && currentStore?.show_logo_on_receipt ? currentStore.logo_url : '';
  const storeInitials = (currentStore?.store_name || 'S').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      {/* Receipt Preview */}
      <div className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Check size={32} className="text-primary" />
          </div>
        </div>
        <h2 className="text-center text-xl font-bold text-foreground mb-1">Sale Complete!</h2>
        <p className="text-center text-sm text-muted-foreground mb-6">Receipt #{sale.receipt_no}</p>

        <div className="border-t border-dashed border-border pt-4 space-y-1">
          {/* Store Logo */}
          {storeLogo ? (
            <div className="flex justify-center mb-2">
              <img src={storeLogo} alt={currentStore?.store_name} className="w-16 h-16 object-contain rounded-lg" />
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">{storeInitials}</span>
              </div>
            </div>
          )}
          <div className="text-center text-sm font-medium text-foreground">{currentStore?.store_name}</div>
          {currentStore?.location && <div className="text-center text-xs text-muted-foreground">{currentStore.location}</div>}
          {currentStore?.phone && <div className="text-center text-xs text-muted-foreground">Tel: {currentStore.phone}</div>}
          <div className="text-center text-xs text-muted-foreground">Store ID: {currentStore?.store_code}</div>
          <div className="text-center text-xs text-muted-foreground">{new Date(sale.sold_at).toLocaleString()}</div>
          {customer && (
            <div className="text-center text-sm text-foreground">
              Customer: {customer.name}{customer.phone ? ` (${customer.phone})` : ''}
            </div>
          )}
          <div className="text-center text-xs text-muted-foreground">Cashier: {user?.full_name}</div>
        </div>

        <div className="border-t border-dashed border-border mt-4 pt-4 space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <div className="flex-1 min-w-0">
                <span className="text-foreground">{item.item_name}</span>
                <span className="text-muted-foreground"> x{item.quantity}</span>
                <span className="text-xs text-muted-foreground block">@ {formatCurrency(item.sell_price)}</span>
              </div>
              <span className="text-foreground font-medium ml-2">{formatCurrency(item.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-border mt-4 pt-4 space-y-1">
          {(sale.discount > 0 || sale.tax > 0) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatCurrency(sale.subtotal)}</span>
            </div>
          )}
          {sale.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-destructive">-{formatCurrency(sale.discount)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax {sale.tax_rate ? `(${sale.tax_rate}%)` : ''}</span>
              <span className="text-foreground">{formatCurrency(sale.tax)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-1">
            <span className="text-foreground">Total</span>
            <span className="text-primary">{formatCurrency(sale.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid</span>
            <span className="text-primary">{formatCurrency(sale.paid_amount)}</span>
          </div>
          {sale.outstanding_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credit Balance</span>
              <span className="text-destructive">{formatCurrency(sale.outstanding_amount)}</span>
            </div>
          )}
          {sale.paid_amount > sale.total && sale.outstanding_amount <= 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Change</span>
              <span className="text-primary">{formatCurrency(sale.paid_amount - sale.total)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="text-foreground font-medium">{paymentMethod.toUpperCase()}</span>
          </div>
        </div>

        {sale.status === 'returned' && (
          <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-center">
            <span className="text-destructive font-bold text-sm">RETURNED / REFUNDED</span>
          </div>
        )}

        <div className="border-t border-dashed border-border mt-4 pt-3 space-y-1">
          <p className="text-center text-xs text-muted-foreground">{currentStore?.receipt_thank_you_message || 'Thank you for your purchase!'}</p>
          {currentStore?.receipt_footer_text && (
            <p className="text-center text-xs text-muted-foreground">{currentStore.receipt_footer_text}</p>
          )}
          <p className="text-center text-[10px] text-muted-foreground/60 italic">Powered by Nasri Point</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm mt-4 grid grid-cols-3 gap-3">
        <button onClick={() => openFormatPicker('print')}
          className="py-3 rounded-xl bg-info text-info-foreground font-bold flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform">
          <Printer size={20} />
          <span className="text-xs">Print</span>
        </button>
        <button onClick={() => openFormatPicker('download')}
          className="py-3 rounded-xl bg-primary text-primary-foreground font-bold flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform">
          <Download size={20} />
          <span className="text-xs">PDF</span>
        </button>
        <button onClick={handleShare}
          className="py-3 rounded-xl bg-accent text-foreground font-bold flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform">
          <Share2 size={20} />
          <span className="text-xs">Share</span>
        </button>
      </div>

      <button onClick={() => navigate('/dashboard')}
        className="w-full max-w-sm mt-3 py-3 rounded-xl bg-card ring-1 ring-border text-foreground font-bold active:scale-[0.98] transition-transform">
        Back to Dashboard
      </button>

      <button onClick={() => navigate('/receipt-history')}
        className="w-full max-w-sm mt-2 py-3 rounded-xl text-muted-foreground font-medium text-sm">
        View Receipt History
      </button>

      {/* Format Picker Modal */}
      {showFormatPicker && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end lg:items-center lg:justify-center" onClick={() => setShowFormatPicker(false)}>
          <div className="w-full lg:w-[400px] bg-card rounded-t-2xl lg:rounded-2xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {printAction === 'print' ? 'Select Print Format' : 'Select PDF Format'}
            </h3>

            <button onClick={() => handlePrint('58mm')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">58mm Thermal</p>
                <p className="text-xs text-muted-foreground">Compact receipt for small printers</p>
              </div>
            </button>

            <button onClick={() => handlePrint('80mm')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <FileText size={20} className="text-info" />
              </div>
              <div>
                <p className="font-semibold text-foreground">80mm Thermal</p>
                <p className="text-xs text-muted-foreground">Standard thermal receipt format</p>
              </div>
            </button>

            <button onClick={() => handlePrint('a4')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <FileText size={20} className="text-warning" />
              </div>
              <div>
                <p className="font-semibold text-foreground">A4 Invoice</p>
                <p className="text-xs text-muted-foreground">Full-page professional invoice</p>
              </div>
            </button>

            <button onClick={() => setShowFormatPicker(false)}
              className="w-full py-3 rounded-xl bg-accent text-foreground font-medium mt-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
