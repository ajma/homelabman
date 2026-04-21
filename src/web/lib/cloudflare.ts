import { api } from './api';
import type { CloudflareProviderFormValue } from '../components/CloudflareProviderForm';
import type { ProjectTemplate } from '@shared/types';

/** Resolves the final tunnelId and optional tunnelToken before saving a Cloudflare provider.
 *  - If tunnelId === '__new__': creates the tunnel via CF API, returns new tunnelId + tunnelToken.
 *  - If deployContainer: fetches the token for the existing tunnel.
 *  - Otherwise returns the existing tunnelId with null token.
 *  Throws on CF API errors.
 */
export async function resolveCloudflareBeforeSave(cf: CloudflareProviderFormValue): Promise<{
  tunnelId: string;
  tunnelToken: string | null;
}> {
  let tunnelId = cf.tunnelId;
  let tunnelToken: string | null = null;

  if (tunnelId === '__new__') {
    const result = await api.post<{ tunnelId: string; tunnelToken: string }>('/cloudflare/tunnels/create', {
      apiToken: cf.apiToken,
      accountId: cf.accountId,
      tunnelName: cf.tunnelName,
    });
    tunnelId = result.tunnelId;
    tunnelToken = result.tunnelToken;
  } else if (cf.deployContainer) {
    const result = await api.post<{ tunnelToken: string }>('/cloudflare/tunnels/token', {
      apiToken: cf.apiToken,
      accountId: cf.accountId,
      tunnelId,
    });
    tunnelToken = result.tunnelToken;
  }

  return { tunnelId, tunnelToken };
}

export async function deployCloudflaredProject(tunnelToken: string): Promise<void> {
  const template = await api.get<ProjectTemplate>('/projects/templates/cloudflared');
  const composeContent = template.composeContent.replaceAll('${token}', tunnelToken);
  const project = await api.post<{ id: string }>('/projects', {
    name: template.name,
    logoUrl: template.logoUrl,
    composeContent,
    isInfrastructure: true,
  });
  await api.post(`/projects/${project.id}/deploy`);
}
