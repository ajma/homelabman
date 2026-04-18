import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, HardDrive, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface DockerImage {
  Id: string;
  RepoTags: string[] | null;
  Size: number;
  Created: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

function shortId(id: string): string {
  return id.replace('sha256:', '').slice(0, 12);
}

function getRepoTag(image: DockerImage): string {
  if (!image.RepoTags || image.RepoTags.length === 0) return '<none>';
  return image.RepoTags[0];
}

function useImages() {
  return useQuery<DockerImage[]>({
    queryKey: ['images'],
    queryFn: () => api.get('/docker/images'),
  });
}

function usePullImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/docker/images/${encodeURIComponent(name)}/pull`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      toast.success('Image pulled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to pull image');
    },
  });
}

function useDeleteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/docker/images/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      toast.success('Image removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove image');
    },
  });
}

function usePruneImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ImagesDeleted?: unknown[] }>('/docker/images/prune'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      toast.success(`Pruned ${data?.ImagesDeleted?.length || 0} images`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to prune images');
    },
  });
}

export function Images() {
  const { data: images, isLoading } = useImages();
  const pullImage = usePullImage();
  const deleteImage = useDeleteImage();
  const pruneImages = usePruneImages();

  const [isPulling, setIsPulling] = useState(false);
  const [pullName, setPullName] = useState('');
  const [filter, setFilter] = useState('');

  const handlePull = () => {
    if (!pullName.trim()) return;
    pullImage.mutate(pullName.trim(), {
      onSuccess: () => {
        setPullName('');
        setIsPulling(false);
      },
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete image "${name}"?`)) {
      deleteImage.mutate(id);
    }
  };

  const handlePrune = () => {
    if (confirm('Are you sure you want to prune all unused images? This cannot be undone.')) {
      pruneImages.mutate();
    }
  };

  const filteredImages = images?.filter((image) => {
    if (!filter) return true;
    const tag = getRepoTag(image).toLowerCase();
    const id = shortId(image.Id).toLowerCase();
    const query = filter.toLowerCase();
    return tag.includes(query) || id.includes(query);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Images</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrune}
            disabled={pruneImages.isPending}
          >
            {pruneImages.isPending ? 'Pruning...' : 'Prune Unused'}
          </Button>
          {!isPulling && (
            <Button onClick={() => setIsPulling(true)}>
              <Download className="mr-2 h-4 w-4" />
              Pull Image
            </Button>
          )}
        </div>
      </div>

      {/* Pull Image Form */}
      {isPulling && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-name">Image Name</Label>
              <Input
                id="image-name"
                placeholder="e.g. nginx:latest"
                value={pullName}
                onChange={(e) => setPullName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePull()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsPulling(false);
                  setPullName('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePull}
                disabled={!pullName.trim() || pullImage.isPending}
              >
                {pullImage.isPending ? 'Pulling...' : 'Pull'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Filter */}
      {!isLoading && images && images.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter images by name or ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
        </div>
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
      {!isLoading && images?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <HardDrive className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No images found.</p>
        </div>
      )}

      {/* No Filter Results */}
      {!isLoading && images && images.length > 0 && filteredImages?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No images match your filter.</p>
        </div>
      )}

      {/* Images Table */}
      {!isLoading && filteredImages && filteredImages.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Repository / Tag
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Image ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Size
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
              {filteredImages.map((image) => (
                <tr key={image.Id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-sm font-medium">
                    {getRepoTag(image)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                    {shortId(image.Id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatBytes(image.Size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(image.Created)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleDelete(image.Id, getRepoTag(image))
                      }
                      disabled={deleteImage.isPending}
                      title="Delete image"
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
