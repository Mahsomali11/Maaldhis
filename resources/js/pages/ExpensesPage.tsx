import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';

export default function ExpensesPage() {
  const { expenses, addExpense, currentStore, formatCurrency, user } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('cash');

  const today = new Date().toDateString();
  const todayExpenses = expenses.filter(e => e.store_id === currentStore?.id && new Date(e.created_at).toDateString() === today);
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addExpense({
      store_id: currentStore?.id || '',
      expense_type: type,
      amount: Number(amount),
      note,
      employee_user_id: user?.id || null,
      employee_name: user?.full_name,
      payment_method: method,
      created_by: user?.id || '',
    });
    setType(''); setAmount(''); setNote(''); setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <PageHeader title="Expenses" />
      <div className="px-4 lg:px-8 py-4 lg:py-6 space-y-4 max-w-7xl mx-auto w-full">
        {/* Desktop header with add button */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">Today's Expenses</h3>
          <button onClick={() => setShowForm(true)} className="hidden lg:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm">
            + Add Expense
          </button>
        </div>

        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Expenses list */}
          <div className="lg:col-span-2 space-y-2">
            {todayExpenses.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center">
                <p className="text-muted-foreground">There are no expenses today.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block bg-card rounded-2xl ring-1 ring-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-accent/30">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Time</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Employee</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayExpenses.map(exp => (
                        <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                          <td className="px-5 py-3.5 text-sm font-medium text-foreground">{exp.expense_type}</td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">{new Date(exp.created_at).toLocaleTimeString()}</td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">{exp.employee_name}</td>
                          <td className="px-5 py-3.5 text-sm font-bold text-destructive text-right">{formatCurrency(exp.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden space-y-2">
                  {todayExpenses.map(exp => (
                    <div key={exp.id} className="bg-card rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-foreground">{exp.expense_type}</h4>
                        <p className="text-xs text-muted-foreground">{new Date(exp.created_at).toLocaleTimeString()} • {exp.employee_name}</p>
                      </div>
                      <span className="font-bold text-destructive">{formatCurrency(exp.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Summary card */}
          <div className="mt-4 lg:mt-0">
            <div className="bg-accent rounded-xl p-4 text-center lg:sticky lg:top-20">
              <p className="text-sm text-muted-foreground">Today's total expenses</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(todayTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end lg:items-center lg:justify-center">
          <div className="w-full lg:w-[480px] bg-card rounded-t-2xl lg:rounded-2xl p-6 animate-slide-in-left lg:animate-scale-in">
            <h3 className="text-lg font-bold text-foreground mb-4">Add Expense</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <input value={type} onChange={e => setType(e.target.value)} placeholder="Expense type (e.g., Rent, Transport)"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground">
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
              </select>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="lg:hidden">
        <FAB onClick={() => setShowForm(true)} />
      </div>
    </div>
  );
}
