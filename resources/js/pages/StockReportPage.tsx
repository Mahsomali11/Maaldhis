import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';

export default function StockReportPage() {
  const { items, currentStore, formatCurrency } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const storeItems = items.filter(i => i.store_id === currentStore?.id && i.type === 'product' && i.is_active);
  const totalInventoryCost = storeItems.reduce((s, i) => s + i.quantity * i.cost_price, 0);

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Stock Report History" />
      <div className="px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex justify-between items-center">
            <span className="font-bold text-foreground">Total Inventory Cost:</span>
            <span className="font-bold text-foreground">{formatCurrency(totalInventoryCost)}</span>
          </div>
        </div>

        <p className="text-foreground text-sm">Select the day to view the stock report</p>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground" />

        <p className="text-center font-medium text-foreground">Stock report for {new Date(selectedDate).toLocaleDateString()}</p>

        <div className="bg-card rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-tile-blue">
                <th className="p-2 text-left text-foreground">ID</th>
                <th className="p-2 text-left text-foreground">Item Name</th>
                <th className="p-2 text-right text-foreground">Qty</th>
                <th className="p-2 text-right text-foreground">Cost</th>
                <th className="p-2 text-right text-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {storeItems.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-card' : 'bg-accent/30'}>
                  <td className="p-2 text-foreground">{item.item_code}</td>
                  <td className="p-2 text-foreground">{item.name}</td>
                  <td className="p-2 text-right text-foreground">{item.quantity}</td>
                  <td className="p-2 text-right text-foreground">{formatCurrency(item.cost_price)}</td>
                  <td className="p-2 text-right text-foreground">{formatCurrency(item.quantity * item.cost_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
