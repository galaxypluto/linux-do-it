import { defineConfig } from 'wxt';

const siteMatches = ['https://example.com/*'];

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'My Chrome Extension',
    version: '0.1.0',
    permissions: ['storage', 'sidePanel'],
    optional_permissions: ['activeTab', 'scripting'],
    host_permissions: siteMatches,
    action: {
      default_title: 'My Chrome Extension',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
