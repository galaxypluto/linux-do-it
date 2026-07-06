import type { SiteAction } from '../../ports/SitePort';

export async function performAction(action: SiteAction): Promise<void> {
  switch (action.type) {
    case 'noop':
      return;
    default:
      throw new Error(`Unsupported Linux.do action: ${action.type}`);
  }
}

