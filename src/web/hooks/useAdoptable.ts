import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdoptableStack } from "@shared/types";

export function useAdoptable() {
  return useQuery<AdoptableStack[]>({
    queryKey: ["projects", "adoptable"],
    queryFn: () => api.get("/projects/adoptable"),
    refetchOnWindowFocus: false,
  });
}
