import { describe, expect, it } from 'vitest';
import worker from '../src/backend/index';

describe('setup HTTP boundary', () => {
  it('reports setup status without claiming working features or creating a session', async () => {
    const response = worker.fetch(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'setup-only', featuresImplemented: false });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    'rejects %s feature requests without returning fabricated data', async (method) => {
      const response = worker.fetch(new Request('http://localhost/api/partners', { method }));
      expect(response.status).toBe(501);
      expect(await response.json()).toMatchObject({ error: 'NOT_IMPLEMENTED' });
      expect(response.headers.get('set-cookie')).toBeNull();
    },
  );

  it('does not treat a POST to health as a successful operation', () => {
    expect(worker.fetch(new Request('http://localhost/api/health', { method: 'POST' })).status).toBe(501);
  });

  it('returns 404 outside the API namespace', () => {
    expect(worker.fetch(new Request('http://localhost/apiculture')).status).toBe(404);
  });
});
