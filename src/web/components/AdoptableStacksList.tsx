import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { AdoptableStack, AdoptResult } from '@shared/types';

interface Props {
  stacks: AdoptableStack[];
  onAdopted?: () => void;
}

export function AdoptableStacksList({ stacks, onAdopted }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(stacks.map((s) => s.stackName)),
  );
  const queryClient = useQueryClient();

  const adoptMutation = useMutation({
    mutationFn: (stackNames: string[]) =>
      api.post<AdoptResult>('/projects/adopt', { stackNames }),
    onSuccess: (result) => {
      if (result.adopted.length > 0) {
        toast.success(
          `Adopted ${result.adopted.length} stack${result.adopted.length > 1 ? 's' : ''}`,
        );
      }
      if (result.failed.length > 0) {
        toast.warning(
          `Failed: ${result.failed.map((f) => `${f.stackName} (${f.reason})`).join(', ')}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'adoptable'] });
      onAdopted?.();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Adoption failed');
    },
  });

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {stacks.map((stack) => (
          <label key={stack.stackName} className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={selected.has(stack.stackName)}
              onChange={() => toggle(stack.stackName)}
              className="h-4 w-4 rounded border-white/20 accent-[#649ef5]"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[rgba(255,255,255,0.85)]">
                {stack.stackName}
              </span>
              <span className="text-2xs text-[rgba(255,255,255,0.38)]">
                {stack.containerCount} container{stack.containerCount !== 1 ? 's' : ''}
                {stack.workingDir ? ` · ${stack.workingDir}` : ''}
              </span>
            </div>
          </label>
        ))}
      </div>
      <button
        onClick={() => adoptMutation.mutate([...selected])}
        disabled={selected.size === 0 || adoptMutation.isPending}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#649ef5] px-4 py-1.5 text-sm font-medium text-[#101827] transition-colors hover:bg-[#7db0ff] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {adoptMutation.isPending ? 'Adopting…' : `Adopt selected (${selected.size})`}
      </button>
    </div>
  );
}
