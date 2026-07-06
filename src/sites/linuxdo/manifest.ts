export const siteManifest = {
  id: 'linuxdo',
  displayName: 'Linux.do',
  matches: ['https://linux.do/*'],
  requiredCapabilities: ['content-script', 'side-panel'],
  permissionJustification:
    'Needed to detect Linux.do pages and read the current page after the user opens the site.',
} as const;

