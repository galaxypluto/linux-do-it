import React from 'react';
import './style.css';

export const DEBUG_STORAGE_KEYS = [
  'debug:lastSiteDetection',
  'debug:lastPageSnapshot',
  'debug:lastRuntimeMessage',
  'debug:lastContentReader',
  'debug:lastNativeAction',
  'debug:lastReplyActivity',
] as const;

type DebugStorageKey = (typeof DEBUG_STORAGE_KEYS)[number];

type DebugManifest = chrome.runtime.Manifest & {
  manifest_version?: number;
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
};

type PermissionStatus = boolean | 'unavailable';

type DebugState = {
  extensionId: string;
  manifest: DebugManifest;
  permissionStatus: Record<string, PermissionStatus>;
  diagnosticStorage: Partial<Record<DebugStorageKey, unknown>>;
  storageKeys: string[];
  timestamp: string;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950';
const buttonClass = `${focusRing} inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown> | null, key: string, fallback = 'unknown'): string {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function numberField(source: Record<string, unknown> | null, key: string, fallback = 0): number {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanField(source: Record<string, unknown> | null, key: string): boolean | null {
  const value = source?.[key];
  return typeof value === 'boolean' ? value : null;
}

function nestedRecord(source: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = source?.[key];
  return isRecord(value) ? value : null;
}

export function sanitizeDebugValue(key: DebugStorageKey, value: unknown): unknown {
  if (key !== 'debug:lastReplyActivity' || !isRecord(value)) {
    return value;
  }

  const copy = { ...value };
  delete copy.message;
  return copy;
}

export function pickDiagnosticStorage(storage: Record<string, unknown>): Partial<Record<DebugStorageKey, unknown>> {
  return DEBUG_STORAGE_KEYS.reduce<Partial<Record<DebugStorageKey, unknown>>>((entries, key) => {
    if (Object.prototype.hasOwnProperty.call(storage, key)) {
      entries[key] = sanitizeDebugValue(key, storage[key]);
    }
    return entries;
  }, {});
}

async function loadPermissionStatus(manifest: DebugManifest): Promise<Record<string, PermissionStatus>> {
  const permissions = Array.from(new Set([...(manifest.permissions ?? []), ...(manifest.optional_permissions ?? [])])).sort();

  if (!permissions.length || !chrome.permissions?.contains) {
    return Object.fromEntries(permissions.map((permission) => [permission, 'unavailable']));
  }

  const pairs = await Promise.all(
    permissions.map(async (permission) => {
      try {
        const granted = await chrome.permissions.contains({
          permissions: [permission as chrome.runtime.ManifestPermission],
        });
        return [permission, granted] as const;
      } catch {
        return [permission, 'unavailable'] as const;
      }
    }),
  );

  return Object.fromEntries(pairs);
}

async function loadDebugState(): Promise<DebugState> {
  const storage = await chrome.storage.local.get(null);
  const manifest = chrome.runtime.getManifest() as DebugManifest;

  return {
    extensionId: chrome.runtime.id,
    manifest,
    permissionStatus: await loadPermissionStatus(manifest),
    diagnosticStorage: pickDiagnosticStorage(storage),
    storageKeys: Object.keys(storage).sort(),
    timestamp: new Date().toISOString(),
  };
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function permissionLabel(value: PermissionStatus | undefined): string {
  if (value === true) {
    return 'granted';
  }
  if (value === false) {
    return 'not granted';
  }
  return 'unknown';
}

function permissionTone(value: PermissionStatus | undefined): 'success' | 'warning' | 'neutral' {
  if (value === true) {
    return 'success';
  }
  if (value === false) {
    return 'warning';
  }
  return 'neutral';
}

export default function DebugApp() {
  const [state, setState] = React.useState<DebugState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setError(null);
    void loadDebugState()
      .then(setState)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main
      className="min-h-screen bg-[var(--debug-bg)] text-[var(--debug-text)] antialiased animate-fade-in-slide"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-5">
        <header className="debug-toolbar">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-cyan-700 dark:text-cyan-300">Debug</p>
            <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-zinc-950 dark:text-zinc-50">
              Linux.do Reader
            </h1>
            <p className="mt-1 break-all text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              {state?.extensionId ?? 'loading'}
            </p>
          </div>
          <button type="button" className={buttonClass} onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </header>

        {error ? (
          <section className="debug-alert" role="alert">
            {error}
          </section>
        ) : null}

        {state ? <DebugDashboard state={state} /> : <DebugSkeleton />}
      </div>
    </main>
  );
}

function DebugDashboard({ state }: { state: DebugState }) {
  const storage = state.diagnosticStorage;
  const siteDetection = isRecord(storage['debug:lastSiteDetection']) ? storage['debug:lastSiteDetection'] : null;
  const detection = nestedRecord(siteDetection, 'detection');
  const pageSnapshot = isRecord(storage['debug:lastPageSnapshot']) ? storage['debug:lastPageSnapshot'] : null;
  const contentReader = isRecord(storage['debug:lastContentReader']) ? storage['debug:lastContentReader'] : null;
  const runtimeMessage = isRecord(storage['debug:lastRuntimeMessage']) ? storage['debug:lastRuntimeMessage'] : null;
  const nativeAction = isRecord(storage['debug:lastNativeAction']) ? storage['debug:lastNativeAction'] : null;
  const replyActivity = isRecord(storage['debug:lastReplyActivity']) ? storage['debug:lastReplyActivity'] : null;

  const loggedIn = booleanField(detection, 'loggedIn');
  const pageType = stringField(detection, 'pageType', stringField(pageSnapshot, 'pageType'));
  const readerMounted = booleanField(contentReader, 'mounted');
  const diagnosticPayload = {
    manifest: {
      manifestVersion: state.manifest.manifest_version,
      name: state.manifest.name,
      version: state.manifest.version,
      permissions: state.manifest.permissions ?? [],
      optionalPermissions: state.manifest.optional_permissions ?? [],
      hostPermissions: state.manifest.host_permissions ?? [],
      optionalHostPermissions: state.manifest.optional_host_permissions ?? [],
    },
    permissionStatus: state.permissionStatus,
    diagnostics: state.diagnosticStorage,
    storageKeys: state.storageKeys,
    refreshedAt: state.timestamp,
  };

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <MetricCard
          label="Extension"
          value={state.manifest.version ?? 'unknown'}
          detail={state.manifest.name ?? 'Linux.do Reader'}
          tone="neutral"
        />
        <MetricCard
          label="Site"
          value={pageType}
          detail={loggedIn === null ? 'login unknown' : loggedIn ? 'logged in' : 'guest'}
          tone={loggedIn ? 'success' : loggedIn === false ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="Reader"
          value={readerMounted === null ? 'unknown' : readerMounted ? 'mounted' : 'idle'}
          detail={`${numberField(contentReader, 'topicCount')} topics, ${numberField(contentReader, 'pendingTopicCount')} pending`}
          tone={readerMounted ? 'success' : 'neutral'}
        />
        <MetricCard
          label="Runtime"
          value={stringField(runtimeMessage, 'type', 'no message')}
          detail={stringField(runtimeMessage, 'timestamp', state.timestamp)}
          tone={runtimeMessage ? 'success' : 'neutral'}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Diagnostics">
        <Panel title="Page">
          <KeyValue label="Site" value={stringField(detection, 'siteId')} />
          <KeyValue label="Page type" value={pageType} />
          <KeyValue label="Origin" value={stringField(siteDetection, 'urlOrigin')} />
          <KeyValue label="Title" value={stringField(pageSnapshot, 'title')} />
          <KeyValue label="URL" value={stringField(pageSnapshot, 'url')} breakAll />
          <KeyValue label="Text length" value={String(numberField(pageSnapshot, 'textLength'))} />
          <KeyValue label="Detected" value={stringField(siteDetection, 'detectedAt')} />
        </Panel>

        <Panel title="Reader">
          <KeyValue label="Event" value={stringField(contentReader, 'event', stringField(contentReader, 'reason'))} />
          <KeyValue label="Layout" value={stringField(contentReader, 'layout')} />
          <KeyValue label="Density" value={stringField(contentReader, 'density')} />
          <KeyValue label="Endpoint" value={stringField(contentReader, 'endpoint')} breakAll />
          <KeyValue label="Reader topic" value={String(contentReader?.readerTopicId ?? 'none')} />
          <KeyValue label="Updated" value={stringField(contentReader, 'updatedAt')} />
        </Panel>

        <Panel title="Native Action">
          <KeyValue label="Action" value={stringField(nativeAction, 'action')} />
          <KeyValue label="Post" value={String(nativeAction?.postNumber ?? 'none')} />
          <KeyValue label="Status" value={stringField(nativeAction, 'status')} />
          <KeyValue label="Result" value={booleanField(nativeAction, 'ok') === false ? 'failed' : booleanField(nativeAction, 'ok') ? 'ok' : 'unknown'} />
          <KeyValue label="Message" value={stringField(nativeAction, 'message', 'none')} />
          <KeyValue label="Updated" value={stringField(nativeAction, 'updatedAt')} />
        </Panel>

        <Panel title="Storage">
          <KeyValue label="Known debug keys" value={`${Object.keys(state.diagnosticStorage).length} / ${DEBUG_STORAGE_KEYS.length}`} />
          <KeyValue label="Local keys" value={String(state.storageKeys.length)} />
          <KeyValue label="Last reply status" value={stringField(replyActivity, 'status', 'none')} />
          <KeyValue label="Last reply topic" value={String(replyActivity?.topicId ?? 'none')} />
          <KeyValue label="Refreshed" value={formatDateTime(state.timestamp)} />
        </Panel>
      </section>

      <Panel title="Permissions">
        <div className="flex flex-wrap gap-2">
          {Object.keys(state.permissionStatus).length ? (
            Object.entries(state.permissionStatus).map(([permission, status]) => (
              <Badge key={permission} tone={permissionTone(status)}>
                {permission}: {permissionLabel(status)}
              </Badge>
            ))
          ) : (
            <Badge tone="neutral">none</Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(state.manifest.host_permissions ?? []).map((origin) => (
            <Badge key={origin} tone="info">
              {origin}
            </Badge>
          ))}
        </div>
      </Panel>

      <Panel title="Diagnostic JSON">
        <pre className="debug-json">{formatJson(diagnosticPayload)}</pre>
      </Panel>
    </>
  );
}

function DebugSkeleton() {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Loading">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="debug-card min-h-28 animate-pulse" />
      ))}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="debug-card animate-fade-in-slide"
    >
      <h2 className="mb-3 text-sm font-bold leading-5 text-zinc-950 dark:text-zinc-50">{title}</h2>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <article
      className="debug-card min-h-28 animate-fade-in-slide"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
        <span className={`debug-dot debug-dot--${tone}`} aria-hidden="true" />
      </div>
      <p className="mt-3 break-words text-xl font-bold leading-tight text-zinc-950 dark:text-zinc-50">{value}</p>
      <p className="mt-2 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-400">{detail}</p>
    </article>
  );
}

function KeyValue({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="debug-row">
      <dt>{label}</dt>
      <dd className={breakAll ? 'break-all' : 'break-words'}>{value}</dd>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'success' | 'warning' | 'neutral' | 'info' }) {
  return <span className={`debug-badge debug-badge--${tone}`}>{children}</span>;
}
