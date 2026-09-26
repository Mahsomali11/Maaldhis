import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { Search, Trash2, Edit, Plus, X, FolderTree, FileText } from 'lucide-react';
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
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-background pb-12">
      <PageHeader 
        title="Categories" 
        rightAction={
          <button 
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Category</span>
          </button>
        }
      />
      
      <div className="p-4 sm:p-6 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Controls Bar */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search categories..."
              className="w-full pl-11 pr-4 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" 
            />
          </div>
          <div className="text-sm font-bold text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg w-full sm:w-auto text-center">
            {filtered.length} Categories
          </div>
        </div>

        {/* Data Table / Cards */}
        {filtered.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-16 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <FolderTree size={32} className="text-muted-foreground/50" />
            </div>
            <h3 className="text-foreground font-semibold text-lg">No categories found</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              {search ? 'Try adjusting your search query.' : 'Create categories to organize your items.'}
            </p>
            {!search && (
              <button 
                onClick={() => handleOpenForm()}
                className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-sm"
              >
                Add Category
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/10">
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest w-1/3">Category Name</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest w-1/2">Description</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <FolderTree size={18} />
                          </div>
                          <span className="font-bold text-foreground text-sm">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-xl truncate">{c.description || '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenForm(c)} className="p-2 rounded-lg bg-background border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shadow-sm" title="Edit Category"><Edit size={14} /></button>
                          <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-lg bg-background border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors shadow-sm" title="Delete Category"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacking Cards */}
            <div className="md:hidden space-y-4">
              {filtered.map((c) => (
                <div key={c.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FolderTree size={20} />
                      </div>
                      <h4 className="font-bold text-foreground text-base">{c.name}</h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenForm(c)} className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"><Edit size={16} /></button>
                      <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  
                  {c.description && (
                    <div className="pt-3 border-t border-border/50">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText size={14} className="text-muted-foreground/70 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{c.description}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/10">
              <h3 className="text-xl font-bold text-foreground">{editingId ? 'Edit Category' : 'Add Category'}</h3>
              <button 
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Category Name <span className="text-destructive">*</span></label>
                <input 
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  placeholder="e.g. Beverages"
                  className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all" 
                  required 
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                  placeholder="Optional details about this category"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all resize-none" 
                  rows={4} 
                />
              </div>
              
              <div className="flex gap-3 pt-6 border-t border-border mt-8">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Category</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{categoryToDelete?.name}"</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl h-11 font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-11 font-bold">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
