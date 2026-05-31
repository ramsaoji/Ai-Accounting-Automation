import type { MasterSummary } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Helper to inject the app-lock session token into API requests
function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem('app_session_token') || '';
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Wrapper for fetch requests requiring authorization. Checks for session validity and triggers lock screen if invalid.
async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: 'include',
  });
  if (res.status === 401) {
    try {
      const clone = res.clone();
      const isJson = clone.headers.get('content-type')?.includes('application/json');
      const body = isJson ? await clone.json() : {};
      if (body?.error && (
        body.error.includes('Missing or invalid token') || 
        body.error.includes('Invalid or expired session')
      )) {
        window.dispatchEvent(new Event('auth-unauthorized'));
      }
    } catch {
      // Ignore JSON/network reading failures
    }
  }
  return res;
}

// Normalized parsing of backend/static response alerts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMasterSummary(data: any, isDebitors: boolean): MasterSummary {
  return {
    ...data,
    runTimestamp: data.runTimestamp || data.timestamp || new Date().toLocaleString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    alerts: data.alerts ? data.alerts.map((a: any) => ({
      ruleId: a.ruleId,
      ruleName: a.ruleName,
      severity: a.severity,
      message: isDebitors ? a.message : (a.example || a.message)
    })) : []
  };
}

export interface SyncResult {
  sales: MasterSummary | null;
  debitors: MasterSummary | null;
  mode: 'live' | 'static' | 'empty';
  isDbConnected?: boolean;
  isLocalDb?: boolean;
  isDevMode?: boolean;
  hasSyncedBefore?: boolean;
  aiProvider?: string;
}

/**
 * Optimized concurrent fetch for accounting data registers.
 * Communicates directly with the live database backend.
 */
export async function fetchAccountingData(): Promise<SyncResult> {
  // Concurrent API fetch including system config to dynamically check Google Drive status
  try {
    const [salesRes, debitorsRes, healthRes] = await Promise.all([
      authFetch(`${apiBaseUrl}/api/v1/data/sales?t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store'
      }),
      authFetch(`${apiBaseUrl}/api/v1/data/debitors?t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store'
      }),
      authFetch(`${apiBaseUrl}/api/v1/system/config?t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store'
      })
    ]);

    const sales = salesRes.ok ? mapMasterSummary(await salesRes.json(), false) : null;
    const debitors = debitorsRes.ok ? mapMasterSummary(await debitorsRes.json(), true) : null;
    
    let mode: 'live' | 'static' | 'empty' = 'static';
    let isDbConnected = false;
    let isLocalDb = false;
    let isDevMode = false;
    let hasSyncedBefore = false;
    let aiProvider = 'none';
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      mode = healthData.connectionMode || 'static';
      isDbConnected = !!healthData.isDbConnected;
      isLocalDb = !!healthData.isLocalDb;
      isDevMode = !!healthData.isDevMode;
      hasSyncedBefore = !!healthData.hasSyncedBefore;
      aiProvider = healthData.provider || 'none';
    }

    return {
      sales,
      debitors,
      mode,
      isDbConnected,
      isLocalDb,
      isDevMode,
      hasSyncedBefore,
      aiProvider
    };
  } catch (err) {
    console.warn('Backend API connection failed.', err);
    return {
      sales: null,
      debitors: null,
      mode: 'empty',
      isDbConnected: false,
      isLocalDb: false,
      isDevMode: false,
      hasSyncedBefore: false
    };
  }
}

/**
 * Handles posting user inputs to the backend AI agent.
 */
export async function sendAdvisorChatMessage(
  message: string,
  isDebitors: boolean,
  history: { sender: 'user' | 'ai'; text: string }[]
): Promise<string> {
  const res = await authFetch(`${apiBaseUrl}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      message,
      workspace: isDebitors ? 'debitors' : 'sales',
      history,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData.error || `API responded with status ${res.status}`;
    throw new Error(errMsg);
  }

  const data = await res.json();
  if (data && data.text) {
    return data.text;
  }
  throw new Error('Invalid response format');
}

/**
 * Verifies upload administrative authorization password with the backend API.
 * Returns the generated session token string on success, or null on failure.
 */
export async function verifyUploadPassword(password: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/security/verify-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        password
      }),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      return data.sessionToken || null;
    }
    return null;
  } catch (err) {
    throw err;
  }
}

/**
 * Uploads an Excel ledger spreadsheet and parses/audits it in real-time using streaming multipart uploads.
 */
export async function uploadSpreadsheet(file: File, sessionToken?: string): Promise<MasterSummary> {
  const formData = new FormData();
  if (sessionToken) {
    formData.append('sessionToken', sessionToken);
  }
  formData.append('file', file, file.name);

  const res = await authFetch(`${apiBaseUrl}/api/v1/ledger/upload`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with status ${res.status}`);
  }

  const summary = await res.json();
  const isDebitors = file.name.toUpperCase().includes('DEBITORS') || summary.isDebitorsList === true;
  return mapMasterSummary(summary, isDebitors);
}

/**
 * Triggers the backend AI accounting pipeline to sync with Google Drive or load from local files.
 */
export async function triggerDriveSync(forceLocal?: boolean): Promise<{ status: 'up-to-date' | 'processing'; message: string }> {
  const res = await authFetch(`${apiBaseUrl}/api/v1/trigger-pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ forceLocal })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with status ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches the current background sync pipeline execution state and error status.
 */
export async function fetchSyncStatus(): Promise<{ status: 'idle' | 'running' | 'success' | 'error'; error: string | null; isRunning: boolean; progress?: any }> {
  const res = await authFetch(`${apiBaseUrl}/api/v1/sync-status`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    throw new Error(`Server responded with status ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches server configuration and health metadata (including cron schedule).
 */
export async function fetchSystemHealth(): Promise<{ cron: string; status: string } | null> {
  try {
    const res = await authFetch(`${apiBaseUrl}/api/v1/system/config?t=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch system health metadata.', err);
  }
  return null;
}

/**
 * Verifies the app lock screen password on the backend.
 * Returns the sessionToken string on success, or null on failure.
 */
export async function verifyAppLockPassword(password: string, remember: boolean): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/security/verify-app`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, remember }),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      return data.sessionToken || null;
    }
    return null;
  } catch (err) {
    console.error('Failed to verify app password:', err);
    throw err;
  }
}

/**
 * Requests backend database password updates.
 */
export async function changeSecurityPasswords(
  currentPassword: string,
  newUploadPassword?: string,
  newAppPassword?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authFetch(`${apiBaseUrl}/api/v1/security/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        currentPassword,
        newUploadPassword,
        newAppPassword
      })
    });
    if (res.ok) {
      return { success: true };
    }
    const data = await res.json().catch(() => ({}));
    return { success: false, error: data.error || 'Server rejected password update request' };
  } catch (err) {
    console.error('Failed to update passwords:', err);
    const errMsg = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, error: errMsg };
  }
}

/**
 * Checks if the browser has an active valid session cookie.
 */
export async function checkSessionStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/security/status`, {
      method: 'GET',
      credentials: 'include',
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to check session status:', err);
    return false;
  }
}

/**
 * Logs out the user by clearing the HttpOnly cookie.
 */
export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/api/v1/security/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Failed to logout user:', err);
  }
}
