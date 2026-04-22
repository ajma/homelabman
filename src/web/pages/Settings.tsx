import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { exposureProviderSchema, type ExposureProviderInput } from '@shared/schemas';
import type { ExposureProviderConfig, Settings as SettingsType } from '@shared/types';
import { api } from '../lib/api';
import { resolveCloudflareBeforeSave, deployCloudflaredProject } from '../lib/cloudflare';
import { CloudflareProviderForm, type CloudflareProviderFormValue } from '../components/CloudflareProviderForm';

interface SetupCheck {
  name: string;
  passed: boolean;
  message: string;
  resolution?: string;
}

interface ProviderSetupResult {
  allPassed: boolean;
  checks: SetupCheck[];
}

const inputCls =
  'flex h-10 w-full rounded-[14px] border border-white/[0.20] bg-[rgba(255,255,255,0.06)] px-4 py-2 text-[14px] text-[rgba(255,255,255,0.85)] placeholder:text-[rgba(255,255,255,0.28)] outline-none transition-colors focus:border-[rgba(100,158,245,0.5)] disabled:cursor-not-allowed disabled:opacity-50';

function SetupCheckDisplay({ result }: { result: ProviderSetupResult }) {
  return (
    <div className="mt-3 space-y-2">
      {result.checks.map((check) => (
        <div key={check.name} className="flex gap-3">
          <span
            className={`mt-px shrink-0 text-[13px] font-medium ${
              check.passed ? 'text-[#4ade80]' : 'text-[rgba(248,113,113,0.85)]'
            }`}
          >
            {check.passed ? '✓' : '✗'}
          </span>
          <div>
            <span className="text-[13px] text-[rgba(255,255,255,0.75)]">{check.name}</span>
            <span className="text-[13px] text-[rgba(255,255,255,0.35)]"> — {check.message}</span>
            {!check.passed && check.resolution && (
              <p className="mt-0.5 text-[12px] text-[rgba(255,255,255,0.38)]">
                Fix: {check.resolution}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProviderTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'caddy' | 'cloudflare';
  onChange: (t: 'caddy' | 'cloudflare') => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`inline-flex rounded-xl border border-white/[0.15] p-0.5 ${disabled ? 'opacity-50' : ''}`}
    >
      {(['caddy', 'cloudflare'] as const).map((type) => (
        <button
          key={type}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(type)}
          className={`rounded-[10px] px-4 py-1.5 text-[13px] font-medium capitalize transition-colors ${
            value === type
              ? 'bg-[rgba(100,158,245,0.15)] text-[#7db0ff]'
              : 'text-[rgba(255,255,255,0.38)] hover:text-[rgba(255,255,255,0.65)]'
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );
}

function ProviderForm({
  provider,
  onSave,
  onCancel,
  isPending,
}: {
  provider?: ExposureProviderConfig;
  onSave: (data: ExposureProviderInput) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [providerType, setProviderType] = useState<'caddy' | 'cloudflare'>(
    (provider?.providerType as 'caddy' | 'cloudflare') ?? 'caddy',
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ExposureProviderInput>({
    resolver: zodResolver(exposureProviderSchema),
    defaultValues: {
      providerType: (provider?.providerType as 'caddy' | 'cloudflare') ?? 'caddy',
      name: provider?.name ?? '',
      enabled: provider?.enabled ?? true,
      configuration: provider?.configuration ?? {},
    },
  });

  const currentConfig = watch('configuration');

  const [cfFormValue, setCfFormValue] = useState<CloudflareProviderFormValue>({
    apiToken: (provider?.configuration as any)?.apiToken ?? '',
    accountId: (provider?.configuration as any)?.accountId ?? '',
    tunnelId: (provider?.configuration as any)?.tunnelId ?? '__new__',
    tunnelName: '',
    deployContainer: true,
  });
  const [isPresaving, setIsPresaving] = useState(false);

  const handleTypeChange = (type: 'caddy' | 'cloudflare') => {
    setProviderType(type);
    setValue('providerType', type);
    setValue('configuration', type === 'caddy' ? { apiUrl: 'http://localhost:2019' } : {});
  };

  return (
    <div className="rounded-2xl border border-white/[0.10] bg-[rgba(255,255,255,0.02)] p-5">
      <h3 className="mb-5 text-[15px] font-semibold text-[rgba(255,255,255,0.88)]">
        {provider ? 'Edit Provider' : 'Add Provider'}
      </h3>
      <form
        onSubmit={handleSubmit(async (data) => {
          if (providerType === 'cloudflare') {
            if (!cfFormValue.apiToken || !cfFormValue.accountId) {
              toast.error('Connect your token and select an account before saving');
              return;
            }
            if (cfFormValue.tunnelId === '__new__' && !cfFormValue.tunnelName.trim()) {
              toast.error('Enter a tunnel name');
              return;
            }

            let tunnelId = cfFormValue.tunnelId;

            setIsPresaving(true);
            try {
              const { tunnelId: resolvedTunnelId, tunnelToken } = await resolveCloudflareBeforeSave(cfFormValue);
              tunnelId = resolvedTunnelId;

              if (cfFormValue.deployContainer && tunnelToken) {
                await deployCloudflaredProject(tunnelToken);
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to create tunnel');
              return;
            } finally {
              setIsPresaving(false);
            }

            onSave({
              ...data,
              configuration: {
                apiToken: cfFormValue.apiToken,
                accountId: cfFormValue.accountId,
                tunnelId,
              },
            });
            return;
          }
          onSave(data);
        })}
        className="space-y-4"
      >
        {/* Provider type */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-[rgba(255,255,255,0.6)]">Type</label>
          <div>
            <ProviderTypeToggle
              value={providerType}
              onChange={handleTypeChange}
              disabled={!!provider}
            />
          </div>
          {!!provider && (
            <p className="text-[12px] text-[rgba(255,255,255,0.28)]">
              Provider type cannot be changed after creation.
            </p>
          )}
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="provider-name" className="text-[12px] font-medium text-[rgba(255,255,255,0.6)]">
            Name
          </label>
          <input
            id="provider-name"
            type="text"
            placeholder="e.g. My Caddy Server"
            className={inputCls}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-[12px] text-[rgba(254,202,202,0.85)]">{errors.name.message}</p>
          )}
        </div>

        {/* Caddy fields */}
        {providerType === 'caddy' && (
          <div className="space-y-1.5">
            <label htmlFor="caddy-api-url" className="text-[12px] font-medium text-[rgba(255,255,255,0.6)]">
              API URL
            </label>
            <input
              id="caddy-api-url"
              type="text"
              placeholder="http://localhost:2019"
              className={inputCls}
              value={(currentConfig as Record<string, string>).apiUrl ?? ''}
              onChange={(e) => setValue('configuration', { apiUrl: e.target.value })}
            />
          </div>
        )}

        {/* Cloudflare fields */}
        {providerType === 'cloudflare' && (
          <CloudflareProviderForm value={cfFormValue} onChange={setCfFormValue} />
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-1.5 text-[13px] text-[rgba(255,255,255,0.4)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isPresaving}
            className="rounded-xl bg-[#649ef5] px-4 py-1.5 text-[13px] font-medium text-[#101827] transition-colors hover:bg-[#7db0ff] disabled:opacity-40"
          >
            {isPending || isPresaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Settings() {
  const queryClient = useQueryClient();
  const [editingProvider, setEditingProvider] = useState<ExposureProviderConfig | null>(null);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [setupResults, setSetupResults] = useState<Record<string, ProviderSetupResult>>({});
  const [checkingSetup, setCheckingSetup] = useState<Record<string, boolean>>({});
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null);

  const runCheckSetup = async (provider: ExposureProviderConfig) => {
    setCheckingSetup((prev) => ({ ...prev, [provider.id]: true }));
    try {
      const result = await api.post<ProviderSetupResult>('/settings/exposure-providers/check-setup', {
        providerType: provider.providerType,
        configuration: provider.configuration,
      });
      setSetupResults((prev) => ({ ...prev, [provider.id]: result }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to check setup');
    } finally {
      setCheckingSetup((prev) => ({ ...prev, [provider.id]: false }));
    }
  };

  const settingsQuery = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
  });

  const providersQuery = useQuery<ExposureProviderConfig[]>({
    queryKey: ['settings', 'providers'],
    queryFn: () => api.get('/settings/exposure-providers'),
  });

  const createProvider = useMutation({
    mutationFn: (data: ExposureProviderInput) => api.post('/settings/exposure-providers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setIsAddingProvider(false);
      toast.success('Provider added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add provider');
    },
  });

  const updateProvider = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExposureProviderInput }) =>
      api.put(`/settings/exposure-providers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditingProvider(null);
      toast.success('Provider updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update provider');
    },
  });

  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/exposure-providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setDeletingProviderId(null);
      toast.success('Provider deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete provider');
      setDeletingProviderId(null);
    },
  });

  const setDefaultProvider = useMutation({
    mutationFn: (providerId: string | null) =>
      api.put('/settings', { defaultExposureProviderId: providerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Default provider updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update default provider');
    },
  });

  const providers = providersQuery.data ?? [];
  const settings = settingsQuery.data;

  return (
    <div className="min-h-full p-6 space-y-8 max-w-3xl">
      <h1 className="text-[18px] font-semibold text-[rgba(255,255,255,0.92)]">Settings</h1>

      {/* Exposure Providers */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[rgba(255,255,255,0.85)]">
              Exposure Providers
            </h2>
            <p className="mt-0.5 text-[13px] text-[rgba(255,255,255,0.38)]">
              Configure how your services are exposed to the internet.
            </p>
          </div>
          {!isAddingProvider && !editingProvider && (
            <button
              onClick={() => setIsAddingProvider(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[rgba(100,158,245,0.4)] px-3 py-1.5 text-[13px] text-[#7db0ff] transition-colors hover:bg-[rgba(100,158,245,0.08)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Provider
            </button>
          )}
        </div>

        {/* Add provider form */}
        {isAddingProvider && (
          <ProviderForm
            onSave={(data) => createProvider.mutate(data)}
            onCancel={() => setIsAddingProvider(false)}
            isPending={createProvider.isPending}
          />
        )}

        {/* Edit provider form */}
        {editingProvider && (
          <ProviderForm
            provider={editingProvider}
            onSave={(data) => updateProvider.mutate({ id: editingProvider.id, data })}
            onCancel={() => setEditingProvider(null)}
            isPending={updateProvider.isPending}
          />
        )}

        {/* Providers list */}
        {providersQuery.isLoading ? (
          <p className="text-[13px] text-[rgba(255,255,255,0.35)]">Loading providers…</p>
        ) : providers.length === 0 && !isAddingProvider ? (
          <div className="rounded-2xl border border-dashed border-white/[0.10] px-6 py-10 text-center">
            <p className="text-[13px] text-[rgba(255,255,255,0.35)]">
              No providers yet.{' '}
              <button
                onClick={() => setIsAddingProvider(true)}
                className="text-[#7db0ff] hover:underline"
              >
                Add one
              </button>{' '}
              to expose your services.
            </p>
          </div>
        ) : providers.length > 0 ? (
          <div className="rounded-2xl border border-white/[0.10] overflow-hidden">
            {providers.map((provider, i) => (
              <div
                key={provider.id}
                className={`px-5 py-4 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: name + type */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-[rgba(255,255,255,0.85)]">
                        {provider.name}
                      </span>
                      {settings?.defaultExposureProviderId === provider.id && (
                        <span className="rounded-full bg-[rgba(100,158,245,0.12)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7db0ff]">
                          Default
                        </span>
                      )}
                      {!provider.enabled && (
                        <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[rgba(255,255,255,0.35)]">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[rgba(255,255,255,0.35)]">
                      {provider.providerType === 'caddy' ? 'Caddy Reverse Proxy' : 'Cloudflare Tunnel'}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex flex-wrap items-center gap-1">
                    {settings?.defaultExposureProviderId !== provider.id && (
                      <button
                        onClick={() => setDefaultProvider.mutate(provider.id)}
                        className="rounded-lg px-2.5 py-1 text-[12px] text-[rgba(255,255,255,0.35)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => runCheckSetup(provider)}
                      disabled={checkingSetup[provider.id]}
                      className="rounded-lg px-2.5 py-1 text-[12px] text-[rgba(255,255,255,0.35)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)] disabled:opacity-40"
                    >
                      {checkingSetup[provider.id] ? 'Checking…' : 'Check setup'}
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingProvider(false);
                        setEditingProvider(provider);
                      }}
                      className="rounded-lg px-2.5 py-1 text-[12px] text-[rgba(255,255,255,0.35)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]"
                    >
                      Edit
                    </button>

                    {/* Inline delete confirm */}
                    {deletingProviderId === provider.id ? (
                      <div className="flex items-center gap-1.5 pl-1">
                        <span className="text-[12px] text-[rgba(255,255,255,0.45)]">Delete?</span>
                        <button
                          onClick={() => setDeletingProviderId(null)}
                          className="text-[12px] text-[rgba(255,255,255,0.35)] transition-colors hover:text-[rgba(255,255,255,0.6)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteProvider.mutate(provider.id)}
                          disabled={deleteProvider.isPending}
                          className="rounded-lg border border-[rgba(248,113,113,0.36)] px-2.5 py-0.5 text-[12px] text-[rgba(254,202,202,0.85)] transition-colors hover:bg-[rgba(127,29,29,0.20)] disabled:opacity-40"
                        >
                          {deleteProvider.isPending ? 'Deleting…' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingProviderId(provider.id)}
                        className="rounded-lg px-2.5 py-1 text-[12px] text-[rgba(255,255,255,0.25)] transition-colors hover:text-[rgba(248,113,113,0.75)]"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Setup check results */}
                {setupResults[provider.id] && (
                  <SetupCheckDisplay result={setupResults[provider.id]} />
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Clear default */}
        {providers.length > 0 && settings?.defaultExposureProviderId && (
          <button
            onClick={() => setDefaultProvider.mutate(null)}
            className="text-[12px] text-[rgba(255,255,255,0.25)] transition-colors hover:text-[rgba(255,255,255,0.5)]"
          >
            Clear default provider
          </button>
        )}
      </section>
    </div>
  );
}
