# Permissions

## Current Manifest Permissions

| Permission | Scope | Reason |
| --- | --- | --- |
| `storage` | Extension storage | Persist reader settings, read-state, and debug snapshots. |
| `sidePanel` | Extension UI | Host the Linux.do search side panel. |
| `https://linux.do/*` | Host permission | Run the content script, fetch Discourse JSON, and inject `pageBridge.js`. |

## Web Accessible Resources

| Resource | Scope | Reason |
| --- | --- | --- |
| `pageBridge.js` | `https://linux.do/*` | Page-context bridge for Discourse native composer and post actions. |

## Optional Permissions

| Permission | Reason |
| --- | --- |
| `activeTab` | Reserved for explicit user-triggered tab access if future flows need it. |
| `scripting` | Reserved for explicit user-triggered injection if future flows need it. |

## Review Rule

Do not add broad host permissions such as `<all_urls>`, `https://*/*`, or `http://*/*` without a concrete feature spec and a permissions review documented here.

Opening the original Linux.do topic uses `chrome.tabs.create` where applicable and does not require the `tabs` permission for basic open-in-new-tab flows.

## Privacy

Linux Do It does not operate a separate backend for user content. Data stays in `chrome.storage` and the user's browser session on `linux.do`. Update this document before adding telemetry or third-party endpoints.
