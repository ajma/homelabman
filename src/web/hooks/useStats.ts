import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useWebSocket } from "./useWebSocket";

export interface ContainerStats {
  containerId: string;
  name: string;
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  status: string;
}

/** Hook for real-time stats via WebSocket */
export function useRealtimeStats(projectId: string | undefined) {
  const [stats, setStats] = useState<ContainerStats[]>([]);
  const ws = useWebSocket();

  useEffect(() => {
    if (!projectId || !ws.connected) return;

    ws.subscribe(projectId);
    const cleanup = ws.on("stats:update", (msg) => {
      if (msg.projectId === projectId) {
        setStats(msg.containers);
      }
    });

    return () => {
      ws.unsubscribe(projectId);
      cleanup();
    };
  }, [projectId, ws.connected]);

  return stats;
}

/** Hook for historical stats */
export function useProjectStats(projectId: string, range: string = "24h") {
  return useQuery({
    queryKey: ["stats", projectId, range],
    queryFn: () =>
      api.get<any[]>(`/projects/${projectId}/stats?range=${range}`),
    enabled: !!projectId,
    refetchInterval: 60000,
  });
}

/** Hook for uptime */
export function useProjectUptime(projectId: string) {
  return useQuery({
    queryKey: ["uptime", projectId],
    queryFn: () => api.get<{ uptime: number }>(`/projects/${projectId}/uptime`),
    enabled: !!projectId,
  });
}
