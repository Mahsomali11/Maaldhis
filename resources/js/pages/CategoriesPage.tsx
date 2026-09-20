import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';
import { Search, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CategoriesPage() {
  const { categories, addCategory, updateCategory, deleteCategory, currentStore } = useApp();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const storeCategories = categories.filter(c => c.store_id === currentStore?.id);
  const filtered = storeCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const categoryToDelete = deleteId ? categories.find(c => c.id === deleteId) : null;

  const handleOpenForm = (category?: any) => {
    if (category) {
      setEditingId(category.id);
      setForm({ name: category.name, description: category.description || '' });
    } else {
      setEditingId(null);
      setForm({ name: '', description: '' });
    }
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;

    if (editingId) {
      await updateCategory(editingId, {
        name: form.name,
        description: form.description,
      });
      toast.success('Category updated');
    } else {
      await addCategory({
        store_id: currentStore.id,
        name: form.name,
        description: form.description,
      });
      toast.success('Category added');
    }
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCategory(deleteId);
    toast.success('Category deleted');
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Categories" />
      <div className="px-4 py-4 space-y-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground" />
        </div>

        <div className="bg-card rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_auto] bg-accent p-3 text-xs font-bold text-muted-foreground">
            <span>Name</span><span>Description</span><span></span>
          </div>
          {filtered.map((c, i) => (
            <div key={c.id} className={`grid grid-cols-[1fr_1fr_auto] p-3 text-sm border-t border-border items-center ${i % 2 === 0 ? 'bg-card' : 'bg-accent/30'}`}>
              <span className="text-foreground font-medium">{c.name}</span>
              <span className="text-foreground truncate">{c.description || '-'}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleOpenForm(c)} className="p-1">
                  <Edit size={16} className="text-primary" />
                </button>
                <button onClick={() => setDeleteId(c.id)} className="p-1">
                  <Trash2 size={16} className="text-destructive" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No categories found.</p>}
        </div>
      </div>

      <FAB onClick={() => handleOpenForm()} />

      {showForm && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">{editingId ? 'Edit Category' : 'Add Category'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Category Name"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" rows={2} />
              
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{categoryToDelete?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
