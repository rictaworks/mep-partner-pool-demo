/** HTTP scaffold only. Session ownership and all business routes remain unimplemented. */
export default {
  fetch(request: Request): Response {
    const path = new URL(request.url).pathname;
    const headers = { 'Cache-Control': 'no-store' };

    if (path === '/api/health' && request.method === 'GET') {
      return Response.json({ status: 'setup-only', featuresImplemented: false }, { headers });
    }

    if (path === '/api' || path.startsWith('/api/')) {
      return Response.json({ error: 'NOT_IMPLEMENTED', message: 'Feature implementation is pending.' }, { status: 501, headers });
    }

    return Response.json({ error: 'NOT_FOUND' }, { status: 404, headers });
  },
} satisfies ExportedHandler;
