import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ProjectTemplateSummary, ProjectTemplate } from "@shared/types";

export function useTemplates() {
  return useQuery<ProjectTemplateSummary[]>({
    queryKey: ["templates"],
    queryFn: () => api.get("/projects/templates"),
  });
}

export function useTemplate(id: string | null) {
  return useQuery<ProjectTemplate>({
    queryKey: ["templates", id],
    queryFn: () => api.get(`/projects/templates/${id}`),
    enabled: !!id,
  });
}
