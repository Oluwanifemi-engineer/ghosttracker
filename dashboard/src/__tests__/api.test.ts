/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';

import MagneetarAPI from '@/lib/api';

const mockFetch = jest.fn<(...args: any[]) => any>();

beforeEach(() => {
  mockFetch.mockReset();
  (global as any).fetch = mockFetch;
  sessionStorage.clear();
});

describe('MagneetarAPI headers — session fallback', () => {
  it('sends the session JWT as Bearer when the instance has no key (user mode)', async () => {
    sessionStorage.setItem('mt_auth_mode', 'user');
    sessionStorage.setItem('mt_api_key', 'session-jwt');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ devices: [] }) });

    // Constructed without credentials — mirrors getAPI() called with no args
    // before useDevices() sets credentials on the singleton (the Sidebar 401 bug).
    const api = new MagneetarAPI('https://api.magneetar.me');
    await api.getDevices();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/devices',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-jwt',
        }),
      })
    );
  });

  it('sends the session JWT as Bearer in apikey mode too (no x-api-key)', async () => {
    // Security (F-02): the API-key login exchanges the key for a dashboard
    // JWT at /api/auth/login and stores THAT — the raw key is never sent as
    // an x-api-key header because the key ships inside the public APK.
    sessionStorage.setItem('mt_auth_mode', 'apikey');
    sessionStorage.setItem('mt_api_key', 'session-dashboard-jwt');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ devices: [] }) });

    const api = new MagneetarAPI('https://api.magneetar.me');
    await api.getDevices();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/devices',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-dashboard-jwt' }),
      })
    );
  });

  it('prefers explicitly set credentials over the session token', async () => {
    sessionStorage.setItem('mt_auth_mode', 'user');
    sessionStorage.setItem('mt_api_key', 'session-jwt');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ devices: [] }) });

    const api = new MagneetarAPI('https://api.magneetar.me', 'explicit-key');
    await api.getDevices();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/devices',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer explicit-key' }),
      })
    );
  });

  it('sends an empty Bearer (never x-api-key) when nothing is configured (logged out)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ devices: [] }) });

    const api = new MagneetarAPI('https://api.magneetar.me');
    await api.getDevices();

    // No x-api-key is ever sent (F-02: the raw key must not be a credential).
    // An empty Bearer is harmless — the server 401s unauthenticated requests.
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/devices',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ' }),
      })
    );
  });
});

describe('MagneetarAPI generateEvidencePDF — binary download', () => {
  it('downloads the PDF blob instead of parsing it as JSON', async () => {
    // Regression (shipped once): this method used the generic request() helper
    // which calls res.json() on a binary application/pdf — the fetch threw and
    // the "Generate Evidence Report" button silently did nothing. It must read
    // the response as a blob and trigger a browser download.
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    mockFetch.mockResolvedValue({ ok: true, blob: async () => pdfBlob });

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    const clickSpy = jest.fn();
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:fake-pdf-url');
    URL.revokeObjectURL = jest.fn();
    const origAppendChild = document.body.appendChild.bind(document.body);
    const origRemove = HTMLElement.prototype.remove;
    // Capture the anchor the method creates and click it.
    let anchor: HTMLAnchorElement | null = null;
    document.body.appendChild = jest.fn((node: Node) => {
      anchor = node as HTMLAnchorElement;
      return node;
    }) as unknown as typeof document.body.appendChild;
    HTMLElement.prototype.remove = jest.fn();

    try {
      // Override anchor.click so the download navigation doesn't actually run.
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = clickSpy as any;
      try {
        const blob = await api.generateEvidencePDF('device-001');
        expect(blob).toBe(pdfBlob);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect((anchor as HTMLAnchorElement | null)?.download).toContain('device-001');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-pdf-url');
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.magneetar.me/api/dashboard/evidence/device-001/generate-pdf',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: 'Bearer jwt' }),
          })
        );
      } finally {
        HTMLAnchorElement.prototype.click = origClick;
      }
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
      document.body.appendChild = origAppendChild;
      HTMLElement.prototype.remove = origRemove;
    }
  });

  it('propagates server errors on PDF generation', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: 'No evidence data found' }),
    });

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    await expect(api.generateEvidencePDF('ghost-device')).rejects.toThrow('No evidence data found');
  });
});

describe('MagneetarAPI exportLocationsCSV — binary download', () => {
  it('downloads the CSV blob instead of parsing it as JSON', async () => {
    // Same binary-download contract as generateEvidencePDF: the endpoint
    // returns text/csv with an attachment header, so the generic request()
    // helper (which calls res.json()) must NOT be used here.
    const csvText = '\ufeffserver_timestamp,lat,lng\n2026-08-01,6.5244,3.3792\n';
    const csvBlob = new Blob([csvText], { type: 'text/csv' });
    mockFetch.mockResolvedValue({ ok: true, blob: async () => csvBlob });

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    const clickSpy = jest.fn();
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:fake-csv-url');
    URL.revokeObjectURL = jest.fn();
    const origAppendChild = document.body.appendChild.bind(document.body);
    const origRemove = HTMLElement.prototype.remove;
    let anchor: HTMLAnchorElement | null = null;
    document.body.appendChild = jest.fn((node: Node) => {
      anchor = node as HTMLAnchorElement;
      return node;
    }) as unknown as typeof document.body.appendChild;
    HTMLElement.prototype.remove = jest.fn();

    try {
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = clickSpy as any;
      try {
        const blob = await api.exportLocationsCSV('device-001');
        expect(blob).toBe(csvBlob);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect((anchor as HTMLAnchorElement | null)?.download).toContain('device-001');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-csv-url');
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.magneetar.me/api/dashboard/locations/device-001/export/csv',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({ Authorization: 'Bearer jwt' }),
          })
        );
      } finally {
        HTMLAnchorElement.prototype.click = origClick;
      }
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
      document.body.appendChild = origAppendChild;
      HTMLElement.prototype.remove = origRemove;
    }
  });

  it('propagates server errors on CSV export', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ detail: 'Access denied: device not linked to your account' }),
    });

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    await expect(api.exportLocationsCSV('someone-elses-device')).rejects.toThrow(
      'Access denied: device not linked to your account'
    );
  });
});

describe('MagneetarAPI geofences — auto-action policy payload', () => {
  it('sends the auto_action policy when creating a geofence', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', geofence_id: 42, auto_action: 'capture' }),
    });

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    const res = await api.createGeofence({
      device_id: 'dev-1',
      name: 'Home',
      center_lat: 6.5244,
      center_lng: 3.3792,
      radius_meters: 300,
      is_safe_zone: true,
      auto_action: 'capture',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/geofence',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          device_id: 'dev-1',
          name: 'Home',
          center_lat: 6.5244,
          center_lng: 3.3792,
          radius_meters: 300,
          is_safe_zone: true,
          auto_action: 'capture',
        }),
      })
    );
    expect(res.auto_action).toBe('capture');
  });

  it('omits auto_action when the caller picks alert-only', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', geofence_id: 7, auto_action: null }),
    });

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    await api.createGeofence({
      device_id: 'dev-1',
      center_lat: 0,
      center_lng: 0,
      radius_meters: 100,
      auto_action: null,
    });

    const body = JSON.parse((mockFetch.mock.calls[0]![1] as any).body);
    expect(body.auto_action).toBeNull();
  });

  it('lists geofences for a device with typed policy fields', async () => {
    const geofence = {
      id: 1,
      device_id: 'dev-1',
      name: 'School',
      center_lat: 6.44,
      center_lng: 3.44,
      radius_meters: 500,
      is_safe_zone: false,
      active: 1,
      last_inside: 0,
      auto_action: 'siren',
      created_at: '2026-08-01T10:00:00+00:00',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ geofences: [geofence] }),
    });

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    const res = await api.getGeofences('dev-1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/geofences/dev-1',
      expect.anything()
    );
    expect(res.geofences).toHaveLength(1);
    expect(res.geofences[0].auto_action).toBe('siren');
    expect(res.geofences[0].name).toBe('School');
  });
});
