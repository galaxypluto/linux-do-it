import React from 'react';

export default function DebugApp() {
  const [state, setState] = React.useState<Record<string, unknown>>({});

  React.useEffect(() => {
    void chrome.storage.local.get(null).then((storage) => {
      setState({
        extensionId: chrome.runtime.id,
        manifest: chrome.runtime.getManifest(),
        storageKeys: Object.keys(storage),
        timestamp: new Date().toISOString(),
      });
    });
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>Extension Debug</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(state, null, 2)}</pre>
    </main>
  );
}
