/**
 * Watson Claw - WhatsApp AI Assistant for University Students
 * Main Cloudflare Worker Entry Point
 * 
 * Architecture:
 * - SaleSmartly (receive) → Worker (process) → CloudWapi (send)
 * - D1 Database for data persistence
 * - Cron triggers for scheduled reminders
 */

import { handleWebhook } from './handlers/webhook.js';
import { handleCron } from './handlers/cron.js';
import { handleHealthCheck } from './handlers/health.js';

export default {
  /**
   * HTTP Request Handler
   * Handles all incoming HTTP requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Add CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Security-Code',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }
    
    try {
      // Route: Health check
      if (url.pathname === '/health') {
        return handleHealthCheck(env, corsHeaders);
      }
      
      // Route: SaleSmartly Webhook
      if (url.pathname === '/webhook/salesmartly') {
        if (request.method !== 'POST') {
          return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
        }
        return handleWebhook(request, env, corsHeaders);
      }
      
      // Route: Root path - info page
      if (url.pathname === '/') {
        return new Response(`🦞 Watson Claw is running!

Environment: ${env.ENVIRONMENT || 'development'}
Version: 1.0.0
Time: ${new Date().toISOString()}

Endpoints:
- GET  /health           - Health check
- POST /webhook/salesmartly - SaleSmartly webhook

Powered by Cloudflare Workers
`, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            ...corsHeaders
          }
        });
      }
      
      // 404 for unknown paths
      return jsonResponse({ 
        error: 'Not found',
        path: url.pathname 
      }, 404, corsHeaders);
      
    } catch (error) {
      console.error('Request handler error:', error);
      return jsonResponse({ 
        error: 'Internal server error',
        message: env.ENVIRONMENT === 'development' ? error.message : undefined
      }, 500, corsHeaders);
    }
  },
  
  /**
   * Scheduled Cron Handler
   * Runs periodically to check and send reminders
   */
  async scheduled(event, env, ctx) {
    console.log(`[Cron] Running scheduled task at ${new Date().toISOString()}`);
    
    try {
      await handleCron(env);
      console.log('[Cron] Task completed successfully');
    } catch (error) {
      console.error('[Cron] Task failed:', error);
      // In production, you might want to send alerts here
    }
  }
};

/**
 * Helper function to create JSON responses
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
