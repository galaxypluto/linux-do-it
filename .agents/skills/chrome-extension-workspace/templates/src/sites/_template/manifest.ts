export const siteManifest = {
  id: 'target-site',
  displayName: 'Target Site',
  matches: ['https://target-site.example.com/*'],
  requiredCapabilities: ['content-script', 'side-panel'],
  permissionJustification: 'Needed to read the current page after the user opens this site and triggers the extension.',
} as const;
