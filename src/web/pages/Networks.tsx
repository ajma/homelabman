import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Network } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface DockerNetwork {
  Id: string;
  Name: string;
  Driver: string;
  Scope: string;
  Created: string;
  Containers: Record<string, unknown> | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function useNetworks() {
  return useQuery<DockerNetwork[]>({
    queryKey: ['networks'],
    queryFn: () => api.get('/docker/networks'),
  });
}

function useCreateNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; driver?: string }) =>
      api.post('/docker/networks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      toast.success('Network created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create network');
    },
  });
}

function useDeleteNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/docker/networks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      toast.success('Network removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove network');
    },
  });
}

const DRIVER_OPTIONS = ['bridge', 'overlay', 'macvlan', 'host', 'none'] as const;

export function Networks() {
  const { data: networks, isLoading } = useNetworks();
  const createNetwork = useCreateNetwork();
  const deleteNetwork = useDeleteNetwork();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDriver, setNewDriver] = useState('bridge');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createNetwork.mutate(
      { name: newName.trim(), driver: newDriver },
      {
        onSuccess: () => {
          setNewName('');
          setNewDriver('bridge');
          setIsCreating(false);
        },
      },
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete network "${name}"?`)) {
      deleteNetwork.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Networks</h2>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Network
          </Button>
        )}
      </div>

      {/* Create Network Form */}
      {isCreating && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="network-name">Network Name</Label>
              <Input
                id="network-name"
                placeholder="e.g. my-network"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="network-driver">Driver</Label>
              <select
                id="network-driver"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newDriver}
                onChange={(e) => setNewDriver(e.target.value)}
              >
                {DRIVER_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setNewName('');
                  setNewDriver('bridge');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createNetwork.isPending}
              >
                {createNetwork.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && networks?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Network className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No networks found.</p>
        </div>
      )}

      {/* Networks Table */}
      {!isLoading && networks && networks.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Scope
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Containers
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {networks.map((network) => (
                <tr key={network.Id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-sm font-medium">{network.Name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                      {network.Driver}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {network.Scope}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {network.Containers ? Object.keys(network.Containers).length : 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(network.Created)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(network.Id, network.Name)}
                      disabled={deleteNetwork.isPending}
                      title="Delete network"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
