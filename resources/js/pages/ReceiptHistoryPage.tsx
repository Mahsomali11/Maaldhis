import { useState } from 'react';
import { router } from '@inertiajs/react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { Printer, Eye, Share2, Download, FileText } from 'lucide-react';
import { printReceipt, shareReceipt, type ReceiptFormat } from '@/lib/receipt-printer';
import { toast } from 'sonner';

export default function ReceiptHistoryPage() {
  const { sales, saleItems, currentStore, formatCurrency, customers, payments, user } = useApp();
  const navigate = (url, options) => router.visit(url, options);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Parse selectedDate as local date (not UTC) to avoid timezone shift
  const [year, month, day] = selectedDate.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  const dateStr = localDate.toDateString();
  const dayReceipts = sales.filter(s => s.store_id === currentStore?.id && new Date(s.sold_at).toDateString() === dateStr);

  const getReceiptData = (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale || !currentStore) return null;
    const items = saleItems.filter(si => si.sale_id === sale.id);
    const customer = sale.customer_id ? customers.find(c => c.id === sale.customer_id) || null : null;
    const salePayment = payments.find(p => p.sale_id === sale.id && p.payment_type === 'sale');
    const paymentMethod = salePayment ? salePayment.method : sale.sale_type;
    return { sale, items, customer, store: currentStore, cashierName: user?.full_name || '', formatCurrency, paymentMethod };
  };

  const handlePrint = (saleId: string, format: ReceiptFormat) => {
    const data = getReceiptData(saleId);
    if (!data) return;
    printReceipt(data, format);
    setShowFormatPicker(false);
    setSelectedSaleId(null);
    toast.success('Print dialog opened');
  };

  const handleQuickPrint = (saleId: string) => {
    const data = getReceiptData(saleId);
    if (!data) return;
    printReceipt(data, '80mm');
    toast.success('Print dialog opened');
  };

  const handleShare = async (saleId: string) => {
    const data = getReceiptData(saleId);
    if (!data) return;
    const result = await shareReceipt(data);
    if (result === 'copied') toast.success('Receipt copied to clipboard!');
  };

  const openFormatPicker = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowFormatPicker(true);
  };

  return (
    <div className="min-h-screen bg-background pb-8 lg:pb-0">
      <PageHeader title="Receipt History" />
      <div className="px-4 lg:px-8 py-4 lg:py-6 space-y-4 max-w-7xl">
        <p className="text-muted-foreground text-sm">Select the date to see all the receipt history</p>

        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="w-full lg:max-w-xs px-4 py-3 rounded-xl border border-input bg-card text-foreground" />

        {dayReceipts.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No receipts found for this date.</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground">{dayReceipts.length} receipt{dayReceipts.length !== 1 ? 's' : ''} found</p>

            {/* Daily Revenue Summary */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
              <span className="font-semibold text-foreground">Day's Total Revenue</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(dayReceipts.filter(s => s.status !== 'returned').reduce((sum, s) => sum + s.total, 0))}
              </span>
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block bg-card rounded-2xl ring-1 ring-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Receipt #</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Time</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Items</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dayReceipts.map(sale => {
                    const items = saleItems.filter(si => si.sale_id === sale.id);
                    const customer = sale.customer_id ? customers.find(c => c.id === sale.customer_id) : null;
                    const salePayment = payments.find(p => p.sale_id === sale.id && p.payment_type === 'sale');
                    const paymentMethod = salePayment ? salePayment.method : sale.sale_type;

                    return (
                      <tr key={sale.id} className="border-b border-border hover:bg-accent/10 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-foreground">{sale.receipt_no}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{new Date(sale.sold_at).toLocaleTimeString()}</td>
                        <td className="px-5 py-4 text-sm text-foreground">{customer?.name || '-'}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{items.length} items</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            sale.sale_type === 'cash' ? 'bg-primary/10 text-primary' :
                            sale.sale_type === 'credit' ? 'bg-warning/10 text-warning' :
                            'bg-info/10 text-info'
                          }`}>{paymentMethod.toUpperCase()}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold ${sale.status === 'completed' ? 'text-primary' : 'text-destructive'}`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-bold text-primary text-right">{formatCurrency(sale.total)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => navigate(`/receipt/${sale.id}`)} title="View"
                              className="p-2 rounded-lg hover:bg-accent transition-colors"><Eye size={16} className="text-info" /></button>
                            <button onClick={() => handleQuickPrint(sale.id)} title="Quick Print (80mm)"
                              className="p-2 rounded-lg hover:bg-accent transition-colors"><Printer size={16} className="text-primary" /></button>
                            <button onClick={() => openFormatPicker(sale.id)} title="Print Options"
                              className="p-2 rounded-lg hover:bg-accent transition-colors"><FileText size={16} className="text-warning" /></button>
                            <button onClick={() => handleShare(sale.id)} title="Share"
                              className="p-2 rounded-lg hover:bg-accent transition-colors"><Share2 size={16} className="text-muted-foreground" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {dayReceipts.map(sale => {
                const items = saleItems.filter(si => si.sale_id === sale.id);
                const customer = sale.customer_id ? customers.find(c => c.id === sale.customer_id) : null;
                const salePayment = payments.find(p => p.sale_id === sale.id && p.payment_type === 'sale');
                const paymentMethod = salePayment ? salePayment.method : sale.sale_type;

                return (
                  <div key={sale.id} className="bg-card rounded-2xl ring-1 ring-border p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-foreground">{sale.receipt_no}</p>
                        <p className="text-xs text-muted-foreground">{new Date(sale.sold_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-primary">{formatCurrency(sale.total)}</span>
                        {sale.status === 'returned' && (
                          <p className="text-xs text-destructive font-semibold">RETURNED</p>
                        )}
                      </div>
                    </div>
                    {items.map(si => (
                      <p key={si.id} className="text-sm text-muted-foreground">{si.item_name} x{si.quantity} — {formatCurrency(si.line_total)}</p>
                    ))}
                    {customer && <p className="text-xs text-info mt-1">Customer: {customer.name}</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        sale.sale_type === 'cash' ? 'bg-primary/10 text-primary' :
                        sale.sale_type === 'credit' ? 'bg-warning/10 text-warning' :
                        'bg-info/10 text-info'
                      }`}>{paymentMethod.toUpperCase()}</span>
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/receipt/${sale.id}`)}
                          className="p-2 rounded-lg bg-accent/50 active:scale-95 transition-transform" title="View">
                          <Eye size={16} className="text-info" />
                        </button>
                        <button onClick={() => handleQuickPrint(sale.id)}
                          className="p-2 rounded-lg bg-accent/50 active:scale-95 transition-transform" title="Print">
                          <Printer size={16} className="text-primary" />
                        </button>
                        <button onClick={() => openFormatPicker(sale.id)}
                          className="p-2 rounded-lg bg-accent/50 active:scale-95 transition-transform" title="More Print Options">
                          <FileText size={16} className="text-warning" />
                        </button>
                        <button onClick={() => handleShare(sale.id)}
                          className="p-2 rounded-lg bg-accent/50 active:scale-95 transition-transform" title="Share">
                          <Share2 size={16} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Format Picker Modal */}
      {showFormatPicker && selectedSaleId && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end lg:items-center lg:justify-center" onClick={() => { setShowFormatPicker(false); setSelectedSaleId(null); }}>
          <div className="w-full lg:w-[400px] bg-card rounded-t-2xl lg:rounded-2xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-2">Print / Download Receipt</h3>

            <button onClick={() => handlePrint(selectedSaleId, '58mm')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Printer size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">58mm Thermal</p>
                <p className="text-xs text-muted-foreground">Compact receipt for small printers</p>
              </div>
            </button>

            <button onClick={() => handlePrint(selectedSaleId, '80mm')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Printer size={20} className="text-info" />
              </div>
              <div>
                <p className="font-semibold text-foreground">80mm Thermal</p>
                <p className="text-xs text-muted-foreground">Standard thermal receipt format</p>
              </div>
            </button>

            <button onClick={() => handlePrint(selectedSaleId, 'a4')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Download size={20} className="text-warning" />
              </div>
              <div>
                <p className="font-semibold text-foreground">A4 Invoice / PDF</p>
                <p className="text-xs text-muted-foreground">Full-page invoice — print or save as PDF</p>
              </div>
            </button>

            <button onClick={() => { setShowFormatPicker(false); setSelectedSaleId(null); }}
              className="w-full py-3 rounded-xl bg-accent text-foreground font-medium mt-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
