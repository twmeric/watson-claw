/**
 * Health Check Handler
 * Returns system status and metrics
 */

export async function handleHealthCheck(env, corsHeaders) {
  const dbStatus = await checkDatabase(env.DB);
  
  const health = {
    status: 'healthy',
    version: '1.0.0',
    environment: env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      // Add more service checks as needed
    }
  };
  
  // Return 200 even if DB is in memory mode (it's still functional)
  const statusCode = (dbStatus.status === 'ok' || dbStatus.mode === 'memory') ? 200 : 503;
  
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
    // Check if D1 is available
    if (!db || typeof db.prepare !== 'function') {
      return {
        status: 'ok',
        mode: 'memory',
        message: 'Running in memory mode (D1 not configured)'
      };
    }
    
    // Simple query to verify DB connection
    const result = await db.prepare('SELECT 1 as test').first();
    return {
      status: 'ok',
      mode: 'd1',
      connected: true
    };
  } catch (error) {
    return {
      status: 'error',
      mode: 'unknown',
      connected: false,
      error: error.message
    };
  }
}
