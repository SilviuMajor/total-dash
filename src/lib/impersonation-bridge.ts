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
