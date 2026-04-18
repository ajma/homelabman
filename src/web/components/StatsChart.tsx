import type { ContainerStats } from '../hooks/useStats';

interface StatsDisplayProps {
  stats: ContainerStats[];
}

/** Format bytes into a human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function StatsDisplay({ stats }: StatsDisplayProps) {
  if (stats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No stats available.</p>
    );
  }

  return (
    <div className="space-y-3">
      {stats.map((s) => (
        <div
          key={s.containerId}
          className="rounded-md border bg-card p-3 text-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">{s.name}</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  s.status === 'running' ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
              <span className="text-xs text-muted-foreground">{s.status}</span>
            </span>
          </div>

          {/* CPU */}
          <div className="mb-1.5">
            <div className="mb-0.5 flex justify-between text-xs text-muted-foreground">
              <span>CPU</span>
              <span>{s.cpuUsage.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(s.cpuUsage, 100)}%` }}
              />
            </div>
          </div>

          {/* Memory */}
          <div className="mb-1.5">
            <div className="mb-0.5 flex justify-between text-xs text-muted-foreground">
              <span>Memory</span>
              <span>
                {formatBytes(s.memoryUsage)} / {formatBytes(s.memoryLimit)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-purple-500 transition-all"
                style={{
                  width: `${
                    s.memoryLimit > 0
                      ? Math.min((s.memoryUsage / s.memoryLimit) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Network I/O */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Net RX: {formatBytes(s.networkRx)}</span>
            <span>Net TX: {formatBytes(s.networkTx)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
