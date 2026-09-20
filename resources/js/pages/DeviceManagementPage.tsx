import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as apiClient } from '@/api';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import { Monitor, Smartphone, Tablet, Laptop, LogOut, Trash2, Globe, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getDeviceId } from '@/lib/device';

export default function DeviceManagementPage() {
  const { user, licenseStatus } = useApp();
  const queryClient = useQueryClient();
  const currentDeviceId = getDeviceId();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['device-sessions', user?.id],
    queryFn: async () => {
      const { data, error } = await apiClient
        .from('device_sessions')
        .select('*')
        .eq('user_id', user!.id)
        .order('last_login', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const logoutDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await apiClient
        .from('device_sessions')
        .update({ status: 'logged_out' } as any)
        .eq('user_id', user!.id)
        .eq('device_id', deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-sessions'] });
      toast.success('Device logged out successfully');
    },
  });

  const removeDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await apiClient
        .from('device_sessions')
        .delete()
        .eq('user_id', user!.id)
        .eq('device_id', deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-sessions'] });
      toast.success('Device removed successfully');
    },
  });

  const logoutAllOthers = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient
        .from('device_sessions')
        .update({ status: 'logged_out' } as any)
        .eq('user_id', user!.id)
        .neq('device_id', currentDeviceId)
        .eq('status', 'active');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-sessions'] });
      toast.success('All other devices logged out');
    },
  });

  const getIcon = (type: string) => {
    if (type === 'mobile') return <Smartphone size={20} />;
    if (type === 'tablet') return <Tablet size={20} />;
    return <Monitor size={20} />;
  };

  const activeDevices = devices.filter((d: any) => d.status === 'active');
  const inactiveDevices = devices.filter((d: any) => d.status !== 'active');

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Active Devices" />
      <div className="px-4 py-4 space-y-4">
        {/* Summary */}
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              Active Devices ({activeDevices.length}{licenseStatus?.max_devices ? ` / ${licenseStatus.max_devices}` : ''})
            </h3>
            {activeDevices.length > 1 && (
              <button
                onClick={() => logoutAllOthers.mutate()}
                className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Log out all others
              </button>
            )}
          </div>
          {licenseStatus?.max_devices && (
            <div className="w-full bg-muted rounded-full h-2 mb-3">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min(100, (activeDevices.length / licenseStatus.max_devices) * 100)}%` }}
              />
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading devices...</p>
          ) : activeDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active devices</p>
          ) : (
            <div className="space-y-3">
              {activeDevices.map((device: any) => (
                <div
                  key={device.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    device.device_id === currentDeviceId
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="text-muted-foreground">
                    {getIcon(device.device_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {device.device_name || 'Unknown Device'}
                      </p>
                      {device.device_id === currentDeviceId && (
                        <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium shrink-0">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="capitalize">{device.device_type}</span>
                      <span>·</span>
                      <Clock size={10} />
                      <span>
                        {formatDistanceToNow(new Date(device.last_login), { addSuffix: true })}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-green-500">Active</span>
                  </div>
                  {device.device_id !== currentDeviceId && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => logoutDevice.mutate(device.device_id)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                        title="Log out device"
                      >
                        <LogOut size={16} />
                      </button>
                      <button
                        onClick={() => removeDevice.mutate(device.device_id)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                        title="Remove device"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive Devices */}
        {inactiveDevices.length > 0 && (
          <div className="bg-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Previous Devices ({inactiveDevices.length})
            </h3>
            <div className="space-y-2">
              {inactiveDevices.map((device: any) => (
                <div key={device.id} className="flex items-center gap-3 p-3 rounded-lg border border-border opacity-60">
                  <div className="text-muted-foreground">{getIcon(device.device_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{device.device_name || 'Unknown Device'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{device.device_type} · {device.status}</p>
                  </div>
                  <button
                    onClick={() => removeDevice.mutate(device.device_id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                    title="Remove device"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
