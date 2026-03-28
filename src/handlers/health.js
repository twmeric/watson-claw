/**
 * Health Check Handler
 * Returns system status and metrics
 */

export async function handleHealthCheck(env, corsHeaders) {
  const health = {
    status: 'healthy',
    version: '1.0.0',
    environment: env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(env.DB),
      // Add more service checks as needed
    }
  };
  
  const statusCode = health.services.database.status === 'ok' ? 200 : 503;
  
  return new Response(JSON.stringify(health, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...corsHeaders
    }
  });
}

async function checkDatabase(db) {
  try {
    // Simple query to verify DB connection
    const result = await db.prepare('SELECT 1 as test').first();
    return {
      status: 'ok',
      connected: true
    };
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      error: error.message
    };
  }
}
