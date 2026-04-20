import { useQuery } from '@tanstack/react-query';
import { Box, Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { Input } from '../components/ui/input';
import { TablePagination } from '../components/TablePagination';

interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Created: number;
  Ports: { PrivatePort: number; PublicPort?: number; Type: string }[];
}

function shortId(id: string): string {
  return id.slice(0, 12);
}

function containerName(names: string[]): string {
  if (!names || names.length === 0) return '<unknown>';
  return names[0].replace(/^\//, '');
}

function formatPorts(ports: DockerContainer['Ports']): string {
  if (!ports || ports.length === 0) return '-';
  return ports
    .filter((p) => p.PublicPort)
    .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`)
    .join(', ') || '-';
}

function stateColor(state: string): string {
  switch (state) {
    case 'running':
      return 'text-green-500';
    case 'exited':
      return 'text-red-500';
    case 'paused':
      return 'text-yellow-500';
    case 'restarting':
      return 'text-blue-500';
    default:
      return 'text-muted-foreground';
  }
}

export function Containers() {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data: containers, isLoading } = useQuery<DockerContainer[]>({
    queryKey: ['containers'],
    queryFn: () => api.get('/docker/containers'),
    refetchInterval: 5000,
  });

  const filtered = containers?.filter((c) => {
    if (!filter) return true;
    const query = filter.toLowerCase();
    const name = containerName(c.Names).toLowerCase();
    const image = c.Image.toLowerCase();
    const id = shortId(c.Id).toLowerCase();
    return name.includes(query) || image.includes(query) || id.includes(query);
  });

  const paginated = filtered?.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Containers</h2>

      {!isLoading && containers && containers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter containers by name, image, or ID..."
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && containers?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Box className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No containers found.</p>
        </div>
      )}

      {!isLoading && containers && containers.length > 0 && filtered?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No containers match your filter.</p>
        </div>
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Image</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Container ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">State</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Ports</th>
              </tr>
            </thead>
            <tbody>
              {paginated!.map((container) => (
                <tr key={container.Id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-sm font-medium">{containerName(container.Names)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{container.Image}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{shortId(container.Id)}</td>
                  <td className={`px-4 py-3 text-sm font-medium capitalize ${stateColor(container.State)}`}>
                    {container.State}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{container.Status}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{formatPorts(container.Ports)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
