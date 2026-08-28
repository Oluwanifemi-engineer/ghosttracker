import { Device, Location, Command, MediaItem, MediaDetail, ErrorLogResponse, UserProfile, Geofence, GeofenceAutoAction, DeviceShare, ShareRole } from '@/types';

// ─── Configuration ───────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.magneetar.me';

// ─── API Client ──────────────────────────────────────────────────────────────

class MagneetarAPI {
  private serverUrl: string;
  private apiKey: string;

  constructor(serverUrl: string = API_BASE, apiKey: string = '') {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  setCredentials(serverUrl: string, apiKey: string) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Fall back to the session's stored token when the shared singleton hasn't
    // been configured yet — e.g. the Sidebar's stats fetch can fire before
    // useDevices() sets credentials on the instance, which used to send an
    // empty Bearer token and 401 on first load after login.
    const sessionKey = typeof window !== 'undefined'
      ? sessionStorage.getItem('mt_api_key')
      : null;
    const key = this.apiKey || sessionKey || '';

    // Both login modes (account and API-key) store a JWT in mt_api_key — the
    // API-key login exchanges the key for a dashboard JWT. The raw key is
    // NEVER sent as a header: the master key ships inside the public APK, so
    // an x-api-key header fallback made anyone with the APK a platform admin
    // (removed server-side). Always authenticate with Bearer.
    headers['Authorization'] = `Bearer ${key}`;
    return headers;
  }

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const opts: RequestInit = {
      method,
      headers: this.headers(),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.serverUrl}${path}`, opts);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(extractErrorMessage(error) || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Health ──────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string; time: string }> {
    return this.request('/health');
  }

  // ── Account / plan ──────────────────────────────────────────────────────

  /** Current user profile — plan tier + enforced device allowance. */
  async fetchMe(): Promise<UserProfile> {
    return this.request('/api/auth/me');
  }

  /**
   * User-account login. With 2FA enabled the server returns a challenge
   * ({ requires_2fa, two_factor_token }) instead of tokens — callers must
   * branch on requires_2fa and complete loginTwoFactor().
   */
  async loginUser(email: string, password: string): Promise<{
    token?: string;
    refresh_token?: string;
    requires_2fa?: boolean;
    two_factor_token?: string;
  }> {
    return this.request('/api/auth/user/login', 'POST', { email, password });
  }

  /** Second factor step: exchange the challenge token + TOTP code for real tokens. */
  async loginTwoFactor(twoFactorToken: string, code: string): Promise<{ token: string; refresh_token: string }> {
    return this.request('/api/auth/user/login/2fa', 'POST', { two_factor_token: twoFactorToken, code });
  }

  /**
   * Request a password reset email. The server returns the SAME response for
   * known and unknown addresses (no account enumeration); success text tells
   * the user to check their inbox either way.
   */
  async forgotPassword(email: string): Promise<{ status: string; message: string }> {
    return this.request('/api/auth/forgot-password', 'POST', { email });
  }

  /** Reset the password with the emailed token. Returns tokens (auto-login). */
  async resetPassword(email: string, token: string, newPassword: string): Promise<{ token: string; refresh_token: string }> {
    return this.request('/api/auth/reset-password', 'POST', { email, token, new_password: newPassword });
  }

  /** Verify the email with the emailed token. */
  async verifyEmail(token: string): Promise<{ status: string; message: string }> {
    return this.request('/api/auth/verify-email', 'POST', { token });
  }

  /** Re-send the verification email for the signed-in account. */
  async resendVerificationEmail(): Promise<{ status: string; message: string; delivered: boolean }> {
    return this.request('/api/auth/verify-email/resend', 'POST');
  }

  /** Start 2FA enrollment: returns the secret + provisioning URI + QR data-URI. */
  async setupTwoFactor(): Promise<{ secret: string; otpauth_uri: string; qr_svg_data_uri: string }> {
    return this.request('/api/auth/2fa/setup', 'POST');
  }

  /** Confirm enrollment with the account password + a fresh TOTP code. */
  async enableTwoFactor(password: string, code: string): Promise<{ status: string; totp_enabled: boolean }> {
    return this.request('/api/auth/2fa/enable', 'POST', { password, code });
  }

  /** Disable 2FA (password step-up). */
  async disableTwoFactor(password: string): Promise<{ status: string; totp_enabled: boolean }> {
    return this.request('/api/auth/2fa/disable', 'POST', { password });
  }

  // ── Devices ─────────────────────────────────────────────────────────────

  async getDevices(): Promise<{ devices: Device[] }> {
    return this.request('/api/dashboard/devices');
  }

  // ── Locations ───────────────────────────────────────────────────────────

  async getLocations(deviceId: string, limit = 200): Promise<{ locations: Location[] }> {
    return this.request(`/api/dashboard/locations/${deviceId}?limit=${limit}`);
  }

  // ── Commands ────────────────────────────────────────────────────────────

  async getCommands(deviceId: string): Promise<{ commands: Command[] }> {
    return this.request(`/api/dashboard/commands/${deviceId}`);
  }

  /**
   * Issue a remote command. `password` is required for destructive commands
   * (wipe) — the server step-up verifies it (account password for users,
   * master API key for admins) before queueing, so a stolen dashboard
   * session alone can never factory-reset a device.
   */
  async issueCommand(deviceId: string, command: string, params = '', password?: string): Promise<{ status: string; command_id: number }> {
    return this.request('/api/dashboard/command', 'POST', {
      device_id: deviceId,
      command,
      params,
      ...(password ? { password } : {}),
    });
  }

  /**
   * Delete a single command from history. Step-up auth: requires the account
   * password (user mode) or the master API key (admin mode) — commands are an
   * audit trail (wipe/lock/alarm), so a dashboard session alone is not enough
   * to erase them.
   */
  async deleteCommand(commandId: number, password: string): Promise<{ status: string; deleted_id: number }> {
    return this.request(`/api/dashboard/commands/${commandId}`, 'DELETE', { password });
  }

  /**
   * Clear a device's command history. only_finished=true (default) removes
   * executed/failed/expired entries but KEEPS pending ones (an in-flight
   * wipe/lock must never be erased mid-delivery). Step-up password required.
   */
  async clearCommandHistory(deviceId: string, password: string, onlyFinished = true): Promise<{ status: string; deleted: number }> {
    return this.request(`/api/dashboard/commands/device/${deviceId}?only_finished=${onlyFinished}`, 'DELETE', { password });
  }

  // ── Media ───────────────────────────────────────────────────────────────

  async getMedia(deviceId: string): Promise<{ media: MediaItem[] }> {
    return this.request(`/api/dashboard/media/${deviceId}`);
  }

  async getMediaFile(mediaId: number): Promise<MediaDetail> {
    return this.request(`/api/dashboard/media/file/${mediaId}`);
  }

  /**
   * Delete a media item. Step-up auth: requires the account password (user
   * mode) or the master API key (admin mode) — a dashboard session alone is
   * not enough to destroy evidence.
   */
  async deleteMedia(mediaId: number, password: string): Promise<{ status: string; deleted_id: number }> {
    return this.request(`/api/dashboard/media/${mediaId}/delete`, 'POST', { password });
  }

  // ── Generic Request ────────────────────────────────────────────────────────

  async fetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    return this.request<T>(path, method, body);
  }

  // ── Evidence ────────────────────────────────────────────────────────────

  async getEvidence(deviceId: string): Promise<any> {
    return this.request(`/api/dashboard/evidence/${deviceId}`);
  }

  /**
   * Generate a forensic PDF evidence report and trigger a browser download.
   *
   * The server returns the PDF as binary (application/pdf) — the generic
   * `request()` helper does `res.json()` and would throw on the PDF bytes,
   * silently killing the "Generate Evidence Report" button. This method
   * fetches the blob, creates an object URL, and clicks an anchor to save it
   * with a sensible filename. Returns the blob so callers can also preview.
   */
  async generateEvidencePDF(deviceId: string): Promise<Blob> {
    const res = await fetch(`${this.serverUrl}/api/dashboard/evidence/${deviceId}/generate-pdf`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(extractErrorMessage(error) || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Magneetar-Evidence-${deviceId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return blob;
  }

  /**
   * Export a device's location history as CSV and trigger a browser download.
   *
   * Same binary-download pattern as generateEvidencePDF: the server returns
   * text/csv with an attachment header — the generic request() helper would
   * try res.json() and throw. Fetches the blob, creates an object URL, and
   * clicks an anchor to save it. Returns the blob so callers can also parse.
   */
  async exportLocationsCSV(deviceId: string): Promise<Blob> {
    const res = await fetch(`${this.serverUrl}/api/dashboard/locations/${deviceId}/export/csv`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(extractErrorMessage(error) || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `magneetar-locations-${deviceId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return blob;
  }

  // ── Alerts ──────────────────────────────────────────────────────────────

  async getAlerts(deviceId: string): Promise<{ alerts: any[] }> {
    return this.request(`/api/dashboard/alerts/${deviceId}`);
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  async getStats(): Promise<{
    total_devices: number;
    active_devices: number;
    stolen_devices: number;
    total_locations: number;
    total_media: number;
    alerts_today: number;
  }> {
    return this.request('/api/dashboard/stats');
  }

  // ── Geofences ───────────────────────────────────────────────────────────

  async getGeofences(deviceId: string): Promise<{ geofences: Geofence[] }> {
    return this.request(`/api/dashboard/geofences/${deviceId}`);
  }

  async createGeofence(data: {
    device_id: string;
    name?: string;
    center_lat: number;
    center_lng: number;
    radius_meters: number;
    is_safe_zone?: boolean;
    auto_action?: GeofenceAutoAction;
  }): Promise<{ status: string; geofence_id: number; auto_action?: GeofenceAutoAction }> {
    return this.request('/api/dashboard/geofence', 'POST', data);
  }

  async deleteGeofence(geofenceId: number): Promise<{ status: string }> {
    return this.request(`/api/dashboard/geofence/${geofenceId}`, 'DELETE');
  }

  // ── Error Log ──────────────────────────────────────────────────────────

  async getErrors(unresolvedOnly = false): Promise<ErrorLogResponse> {
    const params = unresolvedOnly ? '?unresolved_only=true' : '';
    return this.request(`/api/dashboard/errors${params}`);
  }

  async resolveError(errorId: number, notes = ''): Promise<{ status: string }> {
    return this.request(`/api/dashboard/errors/${errorId}/resolve`, 'PATCH', { notes });
  }

  // ── Device Sharing (Milestone 2 P1) ─────────────────────────────────────
  // Family sharing: the device owner grants another account admin/viewer/
  // device_only access. All three endpoints are ownership-gated server-side
  // (grant/revoke = owner only, list = owner + admins).

  /** List accounts with access to a device (owner + admins). */
  async getShares(deviceId: string): Promise<{ shares: DeviceShare[] }> {
    return this.request(`/api/dashboard/devices/${deviceId}/shares`);
  }

  /** Grant (or update) another account's access to a device (owner only). */
  async addShare(deviceId: string, email: string, role: ShareRole): Promise<{
    status: string;
    share_id: string;
    role: ShareRole;
  }> {
    return this.request(`/api/dashboard/devices/${deviceId}/shares`, 'POST', { email, role });
  }

  /** Revoke an account's access to a device (owner only). */
  async revokeShare(deviceId: string, shareId: string): Promise<{ status: string; share_id: string }> {
    return this.request(`/api/dashboard/devices/${deviceId}/shares/${shareId}`, 'DELETE');
  }

  // ── Device Management ───────────────────────────────────────────────────

  async updateDeviceAlias(deviceId: string, alias: string): Promise<{ status: string }> {
    return this.request(`/api/dashboard/devices/${deviceId}/alias`, 'PATCH', { alias });
  }

  async updateDeviceAlertSettings(
    deviceId: string,
    alertPhone: string,
    alertEmail: string,
    opts: {
      alert_channels?: string[] | null;
      enabled_types?: string[] | null;
      quiet_hours_start?: number | null;
      quiet_hours_end?: number | null;
    } = {},
  ): Promise<{
    status: string;
    alert_phone: string;
    alert_email: string;
    alert_channels: string[] | null;
    enabled_types: string[] | null;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
  }> {
    return this.request(`/api/dashboard/devices/${deviceId}/alert-settings`, 'PATCH', {
      alert_phone: alertPhone,
      alert_email: alertEmail,
      ...opts,
    });
  }

  async markDeviceRecovered(deviceId: string): Promise<{ status: string }> {
    return this.request(`/api/dashboard/devices/${deviceId}/recover`, 'POST');
  }

  /**
   * Configure the Offline Command Relay (SMS) for a device: the recipient
   * number (E.164) and the opt-in toggle. When enabled and the device is
   * offline, commands are SMSed to the phone and executed locally — no data
   * connection needed. Owner opt-in only (SMS costs money + is an attack
   * surface), so the toggle defaults to OFF.
   */
  async updateSmsSettings(
    deviceId: string,
    smsPhone: string,
    smsCommandsEnabled: boolean,
  ): Promise<{ status: string; sms_phone: string | null; sms_commands_enabled: boolean }> {
    return this.request(`/api/dashboard/devices/${deviceId}/sms-settings`, 'PATCH', {
      sms_phone: smsPhone,
      sms_commands_enabled: smsCommandsEnabled,
    });
  }

  /**
   * Resolve a cell-tower fingerprint (captured by an offline device with zero
   * internet) to approximate coordinates. Returns resolved=false when no
   * provider is configured or the fingerprint can't be fixed.
   */
  async resolveCellLocation(cellTowerIds: string[]): Promise<{
    resolved: boolean;
    lat?: number;
    lng?: number;
    accuracy_meters?: number | null;
    provider?: string;
    reason?: string;
  }> {
    return this.request('/api/dashboard/cell-locate', 'POST', { cell_tower_ids: cellTowerIds });
  }

  /**
   * Link an ownerless device to this account using the pairing code shown in
   * the Magneetar app on the phone (first 8 hex chars of SHA-256 of the
   * device key). Rate-limited per user server-side.
   */
  async claimDeviceByPairing(deviceId: string, pairingCode: string): Promise<{ status: string; device_id: string; owner_id: string | null }> {
    return this.request('/api/dashboard/devices/claim-by-pairing', 'POST', {
      device_id: deviceId,
      pairing_code: pairingCode,
    });
  }

  async deleteDevice(deviceId: string, password: string): Promise<{ status: string; message: string }> {
    // Step-up password: deletion is destructive, so the server re-authenticates
    // with the account password (users) or the master API key (admin).
    return this.request(`/api/dashboard/devices/${deviceId}`, 'DELETE', { password });
  }

  /**
   * Bulk-delete every ARCHIVED (stale) device — the soft-flagged rows the
   * server dims after ~30 days of silence. One password covers all of them
   * (step-up: account password for users, master API key for admins).
   */
  async deleteArchivedDevices(password: string): Promise<{ status: string; deleted: string[]; count: number }> {
    return this.request('/api/dashboard/devices/archived', 'DELETE', { password });
  }

  async deleteAccount(): Promise<{ status: string; message: string; devices_removed: number }> {
    return this.request('/api/auth/user/account', 'DELETE');
  }

  // ── Stubs for deleted features (keep dashboard compiling) ─────────────
  async getApiKeys(): Promise<{ api_keys: any[] }> { return { api_keys: [] }; }
  async createApiKey(_data: any): Promise<any> { return {}; }
  async revokeApiKey(_keyId: string, _password: string): Promise<any> { return {}; }
  async rotateApiKey(_keyId: string, _password: string): Promise<any> { return {}; }
  async getSubscription(): Promise<any> { return { plan: 'free', status: 'inactive', tier: 'free' }; }
  async initializePayment(_plan: string, _email: string): Promise<any> { return {}; }
  async getBeneficiaries(): Promise<any> { return { beneficiaries: [] }; }
  async addBeneficiary(_data: any): Promise<any> { return {}; }
  async removeBeneficiary(_id: string): Promise<any> { return {}; }
  async getSmartZones(): Promise<any> { return { zones: [] }; }
  async createSmartZone(_data: any): Promise<any> { return {}; }
  async deleteSmartZone(_id: string): Promise<any> { return {}; }
  async autoDiscoverZones(): Promise<any> { return { zones: [] }; }
  async getAnomalies(): Promise<any> { return { anomalies: [] }; }
  async getReferralCode(): Promise<any> { return {}; }
  async getReferralStats(): Promise<any> { return {}; }
  async applyReferralCode(_code: string): Promise<any> { return {}; }
  async getReferralLeaderboard(): Promise<any> { return { leaders: [] }; }
  async getAdminStats(): Promise<any> { return {}; }
  async getFeatureFlags(): Promise<any> { return { flags: {} }; }
  async toggleFeatureFlag(_name: string, _enabled: boolean): Promise<any> { return {}; }
  async toggleMaintenanceMode(): Promise<any> { return {}; }
  async getAdminUsers(): Promise<any> { return { users: [], total: 0 }; }
  async getAdminDevices(): Promise<any> { return { devices: [], total: 0 }; }
  async getGuardianProfile(): Promise<any> { return {}; }
  async setGuardianOptIn(_data: any): Promise<any> { return {}; }
  async launchRecovery(_deviceId: string, _desc?: string): Promise<any> { return {}; }
  async getRecoveryRequests(): Promise<any> { return { requests: [] }; }
  async closeRecovery(_requestId: string): Promise<any> { return {}; }
  async getNearbyRecovery(_lat: number, _lng: number): Promise<any> { return { requests: [] }; }
  async reportSighting(_data: any): Promise<any> { return {}; }
  async getFamilyCircle(): Promise<any> { return { members: [] }; }
  async inviteFamilyMember(_email: string, _role?: string): Promise<any> { return {}; }
  async removeFamilyMember(_id: string): Promise<any> { return {}; }
  async getFamilyLocations(): Promise<any> { return { members: [] }; }
  async reportTheft(_data: any): Promise<any> { return {}; }
  async getHeatmap(_lat: number, _lng: number): Promise<any> { return { hotspots: [] }; }
  async getRecentReports(_lat: number, _lng: number): Promise<any> { return { reports: [] }; }
  async getSafeRoute(_sLat: number, _sLng: number, _eLat: number, _eLng: number): Promise<any> { return { waypoints: [] }; }
  async createBounty(_data: any): Promise<any> { return {}; }
  async getActiveBounties(_lat: number, _lng: number): Promise<any> { return { bounties: [] }; }
  async claimBounty(_data: any): Promise<any> { return {}; }
  async getMyBounties(): Promise<any> { return { bounties: [] }; }
  async createTicket(_data: any): Promise<any> { return {}; }
  async getMyTickets(): Promise<any> { return { tickets: [] }; }
  async getTicketDetail(_id: string): Promise<any> { return {}; }
  async respondToTicket(_id: string, _msg: string): Promise<any> { return {}; }
  async getAdminTickets(): Promise<any> { return { tickets: [] }; }
  async submitNPS(_data: any): Promise<any> { return {}; }
  async getNPSSummary(): Promise<any> { return {}; }
  async getNPSResponses(): Promise<any> { return { responses: [] }; }
  async getEmailStats(): Promise<any> { return {}; }
  async checkIMEI(_imei: string): Promise<any> { return {}; }
  async reportTheftIMEI(_data: any): Promise<any> { return {}; }
  async getTrustQRData(_deviceId: string): Promise<any> { return {}; }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

/**
 * Convert a FastAPI error body into a readable string.
 * 422 validation errors put an array of `{loc, msg}` objects in `detail`;
 * stringifying that directly yields "[object Object]".
 * Returns the fallback when nothing readable is found.
 */
export function extractErrorMessage(body: any, fallback = ''): string {
  const detail = body?.detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d: any) => (typeof d?.msg === 'string' ? d.msg : null))
      .filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (typeof detail === 'string' && detail.trim()) return detail;
  return fallback;
}

let apiInstance: MagneetarAPI | null = null;

export function getAPI(serverUrl?: string, apiKey?: string): MagneetarAPI {
  if (!apiInstance) {
    apiInstance = new MagneetarAPI(serverUrl, apiKey);
  } else if (serverUrl && apiKey) {
    apiInstance.setCredentials(serverUrl, apiKey);
  }
  return apiInstance;
}

export default MagneetarAPI;
