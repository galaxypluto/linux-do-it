import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const linuxDoMatches = ['https://linux.do/*'];

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  vite: ({ command }) => {
    // @vitejs/plugin-react selects the React dev runtime (jsxDEV, the
    // react/jsx-dev-runtime export) when process.env.NODE_ENV !== 'production',
    // regardless of Vite's --mode. A leaked NODE_ENV=development from the
    // shell then ships the dev runtime in the built content script, which
    // throws "(0,H.jsxDEV) is not a function" at load time. Force production
    // for builds so the bundle always uses react/jsx-runtime.
    if (command === 'build' && process.env.NODE_ENV !== 'production') {
      process.env.NODE_ENV = 'production';
    }
    return {
      plugins: [tailwindcss()],
    };
  },
  manifest: {
    name: 'Linux Do It',
    version: '1.0.0',
    description:
      'Enhance Linux.do with card and Reader views, side panel search, read-state sync, and topic-page tools.',
    permissions: ['storage', 'sidePanel'],
    optional_permissions: ['activeTab', 'scripting'],
    host_permissions: linuxDoMatches,
    action: {
      default_title: 'Linux Do It',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    web_accessible_resources: [
      {
        resources: ['pageBridge.js'],
        matches: linuxDoMatches,
      },
    ],
  },
});
