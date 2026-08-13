/**
 * @jest-environment jsdom
 *
 * Device Sharing (Milestone 2 P1) — API client contract tests.
 * Verifies the share endpoints wire the correct method, path, and body so a
 * typo here can't silently break the family-sharing UI (server-side RBAC is
 * covered by server/tests/test_multi_user.py::TestDeviceSharing).
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

function okJson(body: unknown) {
  return { ok: true, json: async () => body };
}

describe('Device sharing API', () => {
  it('getShares GETs the device shares endpoint', async () => {
    const shares = [{ id: 's1', device_id: 'dev-1', role: 'viewer', email: 'fam@example.com' }];
    mockFetch.mockResolvedValue(okJson({ shares }));

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    const res = await api.getShares('dev-1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/devices/dev-1/shares',
      expect.objectContaining({ method: 'GET' })
    );
    expect(res.shares).toEqual(shares);
  });

  it('addShare POSTs the email + role to the shares endpoint', async () => {
    mockFetch.mockResolvedValue(okJson({ status: 'ok', share_id: 's2', role: 'admin' }));

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    const res = await api.addShare('dev-1', 'Family@Example.com', 'admin');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/devices/dev-1/shares',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'Family@Example.com', role: 'admin' }),
      })
    );
    expect(res.share_id).toBe('s2');
  });

  it('revokeShare DELETEs the specific share id', async () => {
    mockFetch.mockResolvedValue(okJson({ status: 'ok', share_id: 's3' }));

    const api = new MagneetarAPI('https://api.magneetar.me', 'jwt');
    const res = await api.revokeShare('dev-1', 's3');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.magneetar.me/api/dashboard/devices/dev-1/shares/s3',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(res.share_id).toBe('s3');
  });
});
