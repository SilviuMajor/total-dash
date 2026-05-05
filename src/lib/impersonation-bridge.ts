const LOCAL_STORAGE_MIRROR_KEY = 'td_impersonation_bridge_mirror';

const SESSION_KEYS = [
  'impersonation_session_id',
  'preview_mode',
  'preview_agency',
  'preview_client',
  'preview_client_agency',
  'preview_agency_name',
  'preview_client_name',
] as const;

type BridgeKey = typeof SESSION_KEYS[number];

interface BridgeMirror {
  values: Partial<Record<BridgeKey, string>>;
  ts: number;
}

export function getImpersonationBridge(): {
  previewMode: string | null;
  sessionId: string | null;
} {
  return {
    previewMode: sessionStorage.getItem('preview_mode'),
    sessionId: sessionStorage.getItem('impersonation_session_id'),
  };
}

export function hasImpersonationBridge(): boolean {
  const { previewMode, sessionId } = getImpersonationBridge();
  return !!(previewMode || sessionId);
}

function readMirror(): BridgeMirror | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MIRROR_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BridgeMirror;
  } catch {
    return null;
  }
}

function snapshotSession(): Partial<Record<BridgeKey, string>> {
  const out: Partial<Record<BridgeKey, string>> = {};
  for (const k of SESSION_KEYS) {
    const v = sessionStorage.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

function syncSessionToMirror(): void {
  try {
    const values = snapshotSession();
    const hasAny = !!values.preview_mode || !!values.impersonation_session_id;
    if (hasAny) {
      localStorage.setItem(
        LOCAL_STORAGE_MIRROR_KEY,
        JSON.stringify({ values, ts: Date.now() } satisfies BridgeMirror),
      );
    } else {
      localStorage.removeItem(LOCAL_STORAGE_MIRROR_KEY);
    }
  } catch {
    // localStorage may throw in private mode or when full — bridge falls back
    // to single-tab behaviour, which is acceptable.
  }
}

function applyMirrorToSession(values: Partial<Record<BridgeKey, string>>): void {
  for (const k of SESSION_KEYS) {
    const v = values[k];
    if (v) sessionStorage.setItem(k, v);
    else sessionStorage.removeItem(k);
  }
}

if (typeof window !== 'undefined') {
  // Cold boot: a tab opened mid-impersonation has empty sessionStorage. Hydrate
  // from the localStorage mirror BEFORE any hook or guard reads sessionStorage,
  // so the boot path sees the active impersonation state.
  const sessionHasBridge =
    !!sessionStorage.getItem('preview_mode') ||
    !!sessionStorage.getItem('impersonation_session_id');
  if (!sessionHasBridge) {
    const mirror = readMirror();
    if (mirror?.values && Object.keys(mirror.values).length > 0) {
      applyMirrorToSession(mirror.values);
    }
  }

  // Local writes: useImpersonation dispatches `impersonation-changed` after
  // every state mutation. Re-mirror sessionStorage to localStorage so other
  // tabs receive the storage event below. Skip when we're hydrating from a
  // remote tab to avoid a feedback loop.
  let hydrating = false;
  window.addEventListener('impersonation-changed', () => {
    if (hydrating) return;
    syncSessionToMirror();
  });

  // Remote writes: another tab changed the mirror. Hydrate this tab's
  // sessionStorage to match, then re-dispatch impersonation-changed so
  // useMultiTenantAuth re-reads its bridge values and the rest of the app
  // catches up.
  window.addEventListener('storage', (e) => {
    if (e.key !== LOCAL_STORAGE_MIRROR_KEY) return;
    hydrating = true;
    try {
      if (e.newValue) {
        try {
          const mirror = JSON.parse(e.newValue) as BridgeMirror;
          applyMirrorToSession(mirror.values || {});
        } catch {
          // ignore malformed mirror
        }
      } else {
        applyMirrorToSession({});
      }
      window.dispatchEvent(new Event('impersonation-changed'));
    } finally {
      hydrating = false;
    }
  });
}
