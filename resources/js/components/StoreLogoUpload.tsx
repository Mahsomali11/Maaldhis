import { useState, useRef } from 'react';
import { Camera, X, ImageIcon } from 'lucide-react';
import { api as apiClient } from '@/api';
import { toast } from 'sonner';

interface StoreLogoUploadProps {
  storeId: string;
  currentLogoUrl: string;
  storeName: string;
  onLogoUploaded: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'w-[60px] h-[60px]',
  md: 'w-[80px] h-[80px]',
  lg: 'w-[100px] h-[100px]',
};

export default function StoreLogoUpload({ storeId, currentLogoUrl, storeName, onLogoUploaded, size = 'lg' }: StoreLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = storeName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 100 || img.height < 100) {
          toast.error('Logo must be at least 100×100 pixels.');
          resolve(false);
        } else {
          resolve(true);
        }
      };
      img.onerror = () => {
        toast.error('Invalid image file.');
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PNG, JPG, JPEG, or SVG files are allowed.');
      return;
    }

    if (file.size > 150 * 1024) {
      toast.error('Logo must be under 150KB.');
      return;
    }

    // Validate dimensions (skip for SVG)
    if (file.type !== 'image/svg+xml') {
      const valid = await validateImage(file);
      if (!valid) return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${storeId}/logo.${ext}`;

      // Delete old file if exists
      await apiClient.storage.from('store-logos').remove([`${storeId}/logo.png`, `${storeId}/logo.jpg`, `${storeId}/logo.jpeg`, `${storeId}/logo.svg`]);

      const { error } = await apiClient.storage.from('store-logos').upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = apiClient.storage.from('store-logos').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update store record
      await apiClient.from('stores').update({ logo_url: publicUrl } as any).eq('id', storeId);

      onLogoUploaded(publicUrl);
      toast.success('Logo uploaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await apiClient.storage.from('store-logos').remove([`${storeId}/logo.png`, `${storeId}/logo.jpg`, `${storeId}/logo.jpeg`, `${storeId}/logo.svg`]);
      await apiClient.from('stores').update({ logo_url: '' } as any).eq('id', storeId);
      onLogoUploaded('');
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className={`${SIZES[size]} rounded-xl overflow-hidden bg-accent/50 border border-border flex items-center justify-center relative shrink-0`}>
        {currentLogoUrl ? (
          <img src={currentLogoUrl} alt={storeName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-muted-foreground">{initials}</span>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors disabled:opacity-50"
        >
          <Camera size={16} />
          {currentLogoUrl ? 'Change Logo' : 'Upload Logo'}
        </button>
        {currentLogoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/15 transition-colors disabled:opacity-50"
          >
            <X size={16} />
            Remove
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">PNG, JPG, SVG · Min 100×100px · Max 150KB</p>
      </div>
    </div>
  );
}
