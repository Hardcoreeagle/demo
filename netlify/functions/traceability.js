const backendUrl = (process.env.TRACEABILITY_API_URL || '').replace(/\/$/, '');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(204, '');
  }

  if (!backendUrl) {
    return response(503, {
      error: 'TRACEABILITY_API_URL is not configured',
      message: 'Deploy the Go server and set TRACEABILITY_API_URL in Netlify environment variables.',
    });
  }

  const functionPrefix = '/.netlify/functions/traceability';
  const requestPath = event.path.startsWith(functionPrefix)
    ? event.path.slice(functionPrefix.length)
    : event.path;
  const query = event.rawQuery ? `?${event.rawQuery}` : '';

  try {
    const upstream = await fetch(`${backendUrl}${requestPath}${query}`, {
      method: event.httpMethod,
      headers: {
        Accept: event.headers.accept || 'application/json',
        'Content-Type': event.headers['content-type'] || 'application/json',
      },
      body: ['GET', 'HEAD'].includes(event.httpMethod) ? undefined : event.body,
    });

    const body = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body,
    };
  } catch (error) {
    return response(502, {
      error: 'Traceability API unavailable',
      message: error.message,
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}