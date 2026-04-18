import { useNavigate } from 'react-router-dom';
import { Play, Square, RotateCcw, ExternalLink, Globe, ArrowUpCircle } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import type { Project } from '@shared/types';
import { useProjectUpdates } from '../hooks/useProjects';
import type { ContainerStats } from '../hooks/useStats';

interface ProjectCardProps {
  project: Project;
  stats?: ContainerStats[];
  onDeploy: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
}

/** Format bytes into a human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const statusConfig: Record<Project['status'], { color: string; label: string }> = {
  running: { color: 'bg-green-500', label: 'Running' },
  stopped: { color: 'bg-gray-400', label: 'Stopped' },
  starting: { color: 'bg-yellow-500 animate-pulse', label: 'Starting' },
  error: { color: 'bg-red-500', label: 'Error' },
};

function timeAgo(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ProjectCard({ project, stats, onDeploy, onStop, onRestart }: ProjectCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[project.status];
  const { data: updates } = useProjectUpdates(project.id);
  const hasUpdates = updates?.some((u) => u.updateAvailable) ?? false;

  const handleCardClick = () => {
    navigate(`/projects/${project.id}`);
  };

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {project.logoUrl && (
              <img
                src={project.logoUrl}
                alt={`${project.name} logo`}
                className="h-8 w-8 shrink-0 rounded object-contain"
              />
            )}
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-tight">
                {project.name}
              </h3>
              {project.domainName && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3 shrink-0" />
                  <a
                    href={`https://${project.domainName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {project.domainName}
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasUpdates && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                <ArrowUpCircle className="h-3 w-3" />
                Update
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
              <span className="text-xs text-muted-foreground">{status.label}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-xs text-muted-foreground">
          Last deployed: {timeAgo(project.deployedAt)}
        </p>

        {/* Live stats preview for running projects */}
        {project.status === 'running' && stats && stats.length > 0 && (() => {
          const totalCpu = stats.reduce((sum, s) => sum + s.cpuUsage, 0);
          const totalMem = stats.reduce((sum, s) => sum + s.memoryUsage, 0);
          const totalMemLimit = stats.reduce((sum, s) => sum + s.memoryLimit, 0);
          return (
            <div className="mt-2 space-y-1.5">
              {/* CPU bar */}
              <div>
                <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>CPU</span>
                  <span>{totalCpu.toFixed(1)}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted">
                  <div
                    className="h-1 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(totalCpu, 100)}%` }}
                  />
                </div>
              </div>
              {/* Memory text */}
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Memory</span>
                <span>{formatBytes(totalMem)} / {formatBytes(totalMemLimit)}</span>
              </div>
            </div>
          );
        })()}
      </CardContent>

      <CardFooter className="gap-2">
        {(project.status === 'stopped' || project.status === 'error') && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDeploy(project.id);
            }}
            title="Deploy"
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            Deploy
          </Button>
        )}
        {project.status === 'running' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStop(project.id);
              }}
              title="Stop"
            >
              <Square className="mr-1 h-3.5 w-3.5" />
              Stop
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRestart(project.id);
              }}
              title="Restart"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Restart
            </Button>
          </>
        )}
        {project.status === 'starting' && (
          <span className="text-xs text-muted-foreground">Deploying...</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${project.id}`);
          }}
          title="Open project editor"
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Open
        </Button>
      </CardFooter>
    </Card>
  );
}
