import { Device, Location, Command, MediaItem, MediaDetail, ErrorLogResponse, GuardianProfile, RecoveryRequest, NearbyRecoveryRequest, UserProfile, Geofence, GeofenceAutoAction, DeviceShare, ShareRole, ApiKey, ApiKeyCreated, ApiKeyScope, ApiKeyType } from '@/types';

// ─── Configuration ───────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

  // ── Developer API Keys (docs/developer-api.md) ──────────────────────────
  // Per-account, scoped, revocable keys for third-party integrations. ALL
  // management endpoints require the account password (step-up): a stolen
  // dashboard session alone can never mint or destroy long-lived credentials.

  /** List the caller's keys — prefix + metadata only (never the full key). */
  async getApiKeys(): Promise<{ api_keys: ApiKey[] }> {
    return this.request('/api/account/api-keys');
  }

  /**
   * Create a scoped key. The FULL key is returned exactly once in `key` —
   * show it to the user immediately, because the server stores only the
   * prefix + hash and cannot recover it later.
   * key_type: 'live' (default) or 'readonly' — readonly keys can never carry
   * write scopes (enforced server-side at creation and at every request).
   */
  async createApiKey(data: {
    name: string;
    scopes: ApiKeyScope[];
    key_type?: ApiKeyType;
    password: string;
    expires_at?: string | null;
  }): Promise<ApiKeyCreated> {
    return this.request('/api/account/api-keys', 'POST', data);
  }

  /** Revoke a key immediately (step-up password). */
  async revokeApiKey(keyId: string, password: string): Promise<{ status: string; id: string }> {
    return this.request(`/api/account/api-keys/${keyId}`, 'DELETE', { password });
  }

  /**
   * Rotate a key: the old one dies instantly, a fresh one with the same
   * name/scopes/expiry is returned (full key shown exactly once).
   */
  async rotateApiKey(keyId: string, password: string): Promise<ApiKeyCreated> {
    return this.request(`/api/account/api-keys/${keyId}/rotate`, 'POST', { password });
  }

  // ── Guardian Network (community recovery) ────────────────────────────────

  async getGuardianProfile(): Promise<GuardianProfile> {
    return this.request('/api/guardian/profile');
  }

  async setGuardianOptIn(data: {
    opted_in: boolean;
    radius_km?: number;
    handle?: string;
  }): Promise<GuardianProfile> {
    return this.request('/api/guardian/opt-in', 'POST', data);
  }

  async launchRecovery(deviceId: string, description?: string): Promise<RecoveryRequest> {
    return this.request('/api/recovery/requests', 'POST', { device_id: deviceId, description });
  }

  async getRecoveryRequests(): Promise<{ requests: RecoveryRequest[] }> {
    return this.request('/api/recovery/requests');
  }

  async closeRecovery(requestId: string): Promise<{ status: string; message: string; request_id: string }> {
    return this.request(`/api/recovery/requests/${requestId}/close`, 'POST');
  }

  async getNearbyRecovery(lat: number, lng: number, radiusKm = 20): Promise<{ requests: NearbyRecoveryRequest[] }> {
    return this.request(`/api/recovery/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`);
  }

  async reportSighting(data: {
    request_id: string;
    lat: number;
    lng: number;
    note?: string;
  }): Promise<{ status: string; sighting_id: number; guardian_handle: string }> {
    return this.request('/api/recovery/sightings', 'POST', data);
  }

  // ── Family Safety Circles ──────────────────────────────────────────────

  async getFamilyCircle(): Promise<{
    circle_id: string;
    circle_name: string;
    member_count: number;
    members: Array<{
      user_id: string;
      name: string;
      email: string;
      role: string;
      joined_at: string;
      last_seen: string | null;
      location: { lat: number; lng: number } | null;
      battery_percent: number | null;
      is_online: boolean;
    }>;
  }> {
    return this.request('/family/circle');
  }

  async inviteFamilyMember(email: string, role = 'member'): Promise<{ ok: boolean; message: string }> {
    return this.request('/family/invite', 'POST', { email, role });
  }

  async removeFamilyMember(memberId: string): Promise<{ ok: boolean; message: string }> {
    return this.request(`/family/member/${memberId}`, 'DELETE');
  }

  async getFamilyLocations(): Promise<{
    members: Array<{
      user_id: string;
      name: string;
      location: { lat: number; lng: number } | null;
      battery_percent: number | null;
      last_seen: string | null;
      is_online: boolean;
      device_name: string | null;
    }>;
  }> {
    return this.request('/family/locations');
  }

  // ── Payments (Paystack) ────────────────────────────────────────────────

  async initializePayment(plan: string, email: string, callbackUrl?: string): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    return this.request('/payments/initialize', 'POST', { plan, email, callback_url: callbackUrl });
  }

  async verifyPayment(reference: string): Promise<{ ok: boolean; plan: string; status: string; period_end: string }> {
    return this.request(`/payments/verify/${reference}`);
  }

  async getSubscription(): Promise<{
    plan: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    tier: string;
  }> {
    return this.request('/payments/subscription');
  }

  async getTierLimits(): Promise<{ tier: string; limits: Record<string, any> }> {
    return this.request('/payments/tier-limits');
  }

  // ── Community Watch Map ───────────────────────────────────────────────

  async reportTheft(data: {
    lat: number;
    lng: number;
    method: string;
    notes?: string;
  }): Promise<{ report_id: string; status: string }> {
    return this.request('/community/report', 'POST', data);
  }

  async getHeatmap(lat: number, lng: number, radiusKm = 10): Promise<{
    hotspots: Array<{
      lat: number;
      lng: number;
      intensity: number;
      count: number;
      methods: string[];
      risk_level: string;
    }>;
    total_reports: number;
  }> {
    return this.request(`/community/heatmap?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`);
  }

  async getRecentReports(lat: number, lng: number, radiusKm = 5): Promise<{
    reports: Array<{
      id: string;
      lat: number;
      lng: number;
      method: string;
      time_of_day: string;
      created_at: string;
      verified: boolean;
    }>;
  }> {
    return this.request(`/community/reports?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`);
  }

  async getSafeRoute(startLat: number, startLng: number, endLat: number, endLng: number): Promise<{
    waypoints: Array<{ lat: number; lng: number; label: string }>;
    hotspots_avoided: number;
    safety_score: number;
  }> {
    return this.request('/community/safe-route', 'POST', {
      start_lat: startLat, start_lng: startLng, end_lat: endLat, end_lng: endLng,
    });
  }

  // ── Recovery Bounties ──────────────────────────────────────────────────

  async createBounty(data: {
    device_id: string;
    amount: number;
    description?: string;
    contact_phone?: string;
  }): Promise<{ bounty_id: string; amount: number; expires_at: string }> {
    return this.request('/bounties/create', 'POST', data);
  }

  async getActiveBounties(lat: number, lng: number, radiusKm = 20): Promise<{
    bounties: Array<{
      id: string;
      device_id: string;
      amount: number;
      amount_display: string;
      description: string;
      device_name: string;
      created_at: string;
      expires_at: string;
    }>;
  }> {
    return this.request(`/bounties/active?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`);
  }

  async claimBounty(data: {
    bounty_id: string;
    finder_name: string;
    finder_phone: string;
    location_lat: number;
    location_lng: number;
    note?: string;
  }): Promise<{ claim_id: string; status: string }> {
    return this.request('/bounties/claim', 'POST', data);
  }

  async getMyBounties(): Promise<{
    bounties: Array<{
      id: string;
      amount: number;
      amount_display: string;
      status: string;
      device_name: string;
      claim_count: number;
    }>;
  }> {
    return this.request('/bounties/my');
  }

  // ── Admin Dashboard ────────────────────────────────────────────────────

  async getAdminStats(): Promise<any> {
    return this.request('/admin/stats');
  }

  async getAdminUsers(page = 1, limit = 50, search?: string): Promise<{
    users: Array<{
      id: string;
      email: string;
      display_name: string;
      subscription_plan: string;
      subscription_status: string;
      created_at: string;
      last_login: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    return this.request(`/admin/users?${params}`);
  }

  async getAdminDevices(page = 1, limit = 50, status?: string): Promise<any> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return this.request(`/admin/devices?${params}`);
  }

  // ── Support Tickets ────────────────────────────────────────────────────

  async createTicket(data: {
    subject: string;
    description: string;
    category: string;
    priority?: string;
    device_id?: string;
  }): Promise<{ ticket_id: string; status: string }> {
    return this.request('/support/tickets', 'POST', data);
  }

  async getMyTickets(status?: string): Promise<{
    tickets: Array<{
      id: string;
      subject: string;
      category: string;
      priority: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>;
  }> {
    const params = status ? `?status=${status}` : '';
    return this.request(`/support/tickets${params}`);
  }

  async getTicketDetail(ticketId: string): Promise<any> {
    return this.request(`/support/tickets/${ticketId}`);
  }

  async respondToTicket(ticketId: string, message: string): Promise<{ ok: boolean }> {
    return this.request(`/support/tickets/${ticketId}/respond`, 'POST', { message });
  }

  async getAdminTickets(status?: string, category?: string, page = 1): Promise<any> {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    return this.request(`/support/admin/tickets?${params}`);
  }

  // ── NPS Survey ─────────────────────────────────────────────────────────

  async submitNPS(data: {
    ticket_id: string;
    score: number;
    comment?: string;
  }): Promise<{ score: number; label: string }> {
    return this.request('/nps/submit', 'POST', data);
  }

  async getNPSSummary(days = 30): Promise<{
    total_responses: number;
    average_score: number;
    promoters: number;
    passives: number;
    detractors: number;
    nps_score: number;
  }> {
    return this.request(`/nps/summary?days=${days}`);
  }

  async getNPSResponses(limit = 50): Promise<{
    responses: Array<{
      score: number;
      comment: string | null;
      category: string;
      created_at: string;
      user_name: string;
      user_email: string;
    }>;
  }> {
    return this.request(`/nps/responses?limit=${limit}`);
  }

  // ── Email Stats ────────────────────────────────────────────────────────

  async getEmailStats(): Promise<{
    total: number;
    sent: number;
    failed: number;
    opened: number;
    clicked: number;
    open_rate: number;
    click_rate: number;
    delivery_rate: number;
  }> {
    return this.request('/email/stats');
  }

  // ── Trust Score ────────────────────────────────────────────────────────

  async checkIMEI(imei: string): Promise<{
    imei: string;
    trust_score: number;
    status: string;
    device_info: { brand: string; model: string; type: string } | null;
    owner_verified: boolean;
    theft_reports: number;
    last_active: string | null;
    warnings: string[];
  }> {
    return this.request('/trust/check', 'POST', { imei, check_type: 'full' });
  }

  async reportTheftIMEI(data: {
    imei: string;
    theft_date: string;
    theft_location?: string;
    theft_method?: string;
    description?: string;
  }): Promise<{ ok: boolean; report_id: string }> {
    return this.request('/trust/report-theft', 'POST', data);
  }

  async getTrustQRData(deviceId: string): Promise<{
    device_id: string;
    trust_score: number;
    status: string;
    qr_url: string;
  }> {
    return this.request(`/trust/qr-data/${deviceId}`);
  }

  // ── Digital Inheritance ─────────────────────────────────────────────────

  async getBeneficiaries(): Promise<{
    beneficiaries: Array<{
      id: string;
      name: string;
      email: string;
      relationship: string;
      access_level: string;
      delay_hours: number;
      status: string;
    }>;
  }> {
    return this.request('/inheritance/beneficiaries');
  }

  async addBeneficiary(data: {
    name: string;
    email: string;
    relationship: string;
    access_level?: string;
    delay_hours?: number;
  }): Promise<{ ok: boolean; access_code: string }> {
    return this.request('/inheritance/beneficiary', 'POST', data);
  }

  async removeBeneficiary(id: string): Promise<{ ok: boolean }> {
    return this.request(`/inheritance/beneficiary/${id}`, 'DELETE');
  }

  // ── Smart Geofencing ───────────────────────────────────────────────────

  async getSmartZones(): Promise<{
    zones: Array<{
      id: string;
      name: string;
      zone_type: string;
      lat: number;
      lng: number;
      radius_meters: number;
    }>;
  }> {
    return this.request('/geofence/zones');
  }

  async createSmartZone(data: {
    name: string;
    zone_type?: string;
    lat: number;
    lng: number;
    radius_meters?: number;
  }): Promise<{ ok: boolean; zone_id: string }> {
    return this.request('/geofence/zone', 'POST', data);
  }

  async deleteSmartZone(id: string): Promise<{ ok: boolean }> {
    return this.request(`/geofence/zone/${id}`, 'DELETE');
  }

  async autoDiscoverZones(): Promise<{
    zones: Array<{ zone_id: string; name: string; zone_type: string }>;
  }> {
    return this.request('/geofence/auto-discover', 'POST');
  }

  async getAnomalies(): Promise<{
    anomalies: Array<{
      device_id: string;
      device_name: string;
      anomaly_type: string;
      description: string;
      severity: string;
    }>;
  }> {
    return this.request('/geofence/anomalies');
  }

  // ── Referral Program ──────────────────────────────────────────────────

  async getReferralCode(): Promise<{
    code: string;
    share_url: string;
    share_message: string;
    total_referrals: number;
    successful_referrals: number;
    pending_referrals: number;
    reward_balance: number;
    tier: string;
  }> {
    return this.request('/referrals/code');
  }

  async getReferralStats(): Promise<{
    total_referrals: number;
    successful_referrals: number;
    pending_referrals: number;
    reward_balance: number;
    tier: string;
    next_tier_referrals: number;
    next_tier_name: string;
    recent_referrals: Array<{
      id: string;
      email: string;
      name: string;
      status: string;
    }>;
  }> {
    return this.request('/referrals/stats');
  }

  async applyReferralCode(code: string): Promise<{ ok: boolean; referrer_reward: string }> {
    return this.request('/referrals/apply', 'POST', { code });
  }

  async trackReferralShare(platform: string): Promise<{ ok: boolean }> {
    return this.request(`/referrals/share?platform=${platform}`, 'POST');
  }

  async getReferralLeaderboard(): Promise<{
    leaders: Array<{
      rank: number;
      name: string;
      referral_count: number;
      tier: string;
    }>;
  }> {
    return this.request('/referrals/leaderboard');
  }
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
