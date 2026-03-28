# Watson Claw - POC Implementation Plan

> **Proof of Concept: Validate Core Technical Assumptions**
> Timeline: 2 Days
> Goal: Confirm whatsapp-web.js + Cloudflare Worker integration feasibility

---

## POC Scope

### What We're Validating

| # | Assumption | Validation Method | Success Criteria |
|---|-----------|-------------------|------------------|
| 1 | whatsapp-web.js can reliably receive messages from personal groups | Create "watsonai" group, send test messages | Messages captured in console |
| 2 | whatsapp-web.js can send replies | Programmatically send response | Message appears in WhatsApp |
| 3 | Cloudflare Worker can process webhook | Send HTTP request from local to CF Worker | Worker responds correctly |
| 4 | Integration flow works end-to-end | Message → Local Server → CF Worker → Response | Complete cycle < 3 seconds |

### What's NOT in POC Scope
- ❌ Full intent recognition (mocked)
- ❌ D1/KV operations (can be added later)
- ❌ Multi-user support (single user only)
- ❌ Error handling (happy path only)
- ❌ Production-ready code (hacky is OK)

---

## Day 1: whatsapp-web.js Environment

### Prerequisites

```bash
# System requirements
- Node.js 18+
- Chrome/Chromium browser
- WhatsApp account (secondary number recommended for testing)
```

### Step 1: Project Setup (30 min)

```bash
# Create project directory
mkdir watson-claw-poc
cd watson-claw-poc
npm init -y

# Install dependencies
npm install whatsapp-web.js qrcode-terminal axios
```

### Step 2: Basic WhatsApp Client (1 hour)

Create `whatsapp-client.js`:

```javascript
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,  // Show browser for debugging
        args: ['--no-sandbox']
    }
});

// Generate QR Code for login
client.on('qr', (qr) => {
    console.log('Scan this QR code with your WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Ready to receive messages
client.on('ready', () => {
    console.log('✅ WhatsApp client is ready!');
    console.log('Create a group named "watsonai" and send test messages');
});

// Listen for messages
client.on('message_create', async (msg) => {
    console.log('\n📨 New Message:');
    console.log('From:', msg.from);
    console.log('Chat Name:', msg._data.notifyName || 'Unknown');
    console.log('Body:', msg.body);
    console.log('Is Group:', msg.from.endsWith('@g.us'));
    console.log('---');
    
    // TODO: Check if from "watsonai" group
    // TODO: Send to Cloudflare Worker
    // TODO: Send reply back
});

client.initialize();
```

### Step 3: Group Detection (30 min)

Update message handler:

```javascript
const TARGET_GROUP_NAME = 'watsonai';

client.on('message_create', async (msg) => {
    // Only process messages from the "watsonai" group
    if (!msg.from.endsWith('@g.us')) {
        console.log('⏭️  Ignoring: Not a group message');
        return;
    }
    
    // Get chat info to check group name
    const chat = await msg.getChat();
    console.log('Group Name:', chat.name);
    
    if (chat.name !== TARGET_GROUP_NAME) {
        console.log('⏭️  Ignoring: Not watsonai group');
        return;
    }
    
    console.log('✅ Message from watsonai group:', msg.body);
    
    // Simple echo for POC
    await msg.reply('🦞 Watson received: ' + msg.body);
});
```

### Step 4: Run & Test (1 hour)

```bash
node whatsapp-client.js
```

Test checklist:
- [ ] QR code displays
- [ ] WhatsApp Web connects
- [ ] Create group "watsonai" with yourself
- [ ] Send message in group
- [ ] Message appears in console
- [ ] Echo reply sent back

---

## Day 2: Cloudflare Worker Integration

### Step 1: Create Cloudflare Worker (30 min)

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create worker project
mkdir watson-worker
cd watson-worker
wrangler init --yes
```

### Step 2: Simple Worker (30 min)

Edit `src/index.js`:

```javascript
export default {
    async fetch(request, env, ctx) {
        // CORS headers for local testing
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
        
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { 
                status: 405,
                headers: corsHeaders 
            });
        }
        
        try {
            const body = await request.json();
            console.log('Received:', body);
            
            // Simple mock response for POC
            const response = {
                success: true,
                message: `🦞 Watson processed: "${body.text}"`,
                timestamp: new Date().toISOString(),
                // Mock: Echo back with Watson flair
                reply: `Got it! I'll help you with: "${body.text}"`
            };
            
            return new Response(JSON.stringify(response), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
            
        } catch (error) {
            return new Response(JSON.stringify({ 
                error: error.message 
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
};
```

### Step 3: Deploy Worker (15 min)

```bash
wrangler deploy
# Note the worker URL: https://watson-claw-poc.YOUR_SUBDOMAIN.workers.dev
```

### Step 4: Integrate with WhatsApp Client (1 hour)

Update `whatsapp-client.js`:

```javascript
const axios = require('axios');

const WORKER_URL = 'https://watson-claw-poc.YOUR_SUBDOMAIN.workers.dev';
const TARGET_GROUP_NAME = 'watsonai';

client.on('message_create', async (msg) => {
    // Filter for watsonai group only
    if (!msg.from.endsWith('@g.us')) return;
    
    const chat = await msg.getChat();
    if (chat.name !== TARGET_GROUP_NAME) return;
    
    // Skip messages from self (to avoid loops)
    if (msg.fromMe) return;
    
    console.log('📨 Processing:', msg.body);
    
    try {
        // Send to Cloudflare Worker
        const response = await axios.post(WORKER_URL, {
            text: msg.body,
            from: msg.from,
            timestamp: msg.timestamp,
            groupName: chat.name
        }, {
            timeout: 5000  // 5 second timeout for POC
        });
        
        console.log('✅ Worker response:', response.data);
        
        // Send reply back to WhatsApp
        await msg.reply(response.data.reply);
        console.log('✅ Reply sent');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await msg.reply('🦞 Sorry, I had a hiccup. Please try again.');
    }
});
```

### Step 5: End-to-End Testing (1 hour)

```bash
# Terminal 1: Run WhatsApp client
node whatsapp-client.js

# In WhatsApp "watsonai" group, send:
# "Hello Watson, this is a test"

# Expected output:
# 1. Message appears in Terminal
# 2. Worker receives and processes
# 3. Reply appears in WhatsApp within 3 seconds
```

Test cases:
- [ ] Simple text message
- [ ] Longer message (>100 chars)
- [ ] Special characters
- [ ] Multiple messages in sequence
- [ ] Worker temporarily down (error handling)

---

## Expected Results

### Success Criteria

| Test | Expected | Pass/Fail |
|------|----------|-----------|
| WhatsApp connection | Stable for >10 minutes | |
| Group message detection | 100% accuracy for "watsonai" | |
| Worker response time | < 3 seconds (95th percentile) | |
| Reply delivery | >95% success rate | |
| Error recovery | Graceful degradation | |

### Performance Baseline

```
Message → Worker: ~200-500ms (network)
Worker processing: ~50-100ms (simple logic)
Worker → Reply: ~200-500ms (network)
Total: ~500ms - 1.5s (acceptable for POC)
```

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| WhatsApp Web detection | Medium | Use LocalAuth, add delays between actions |
| QR code expires | Low | Auto-refresh or manual rescan |
| Worker cold start | Medium | Keep-alive ping or accept initial delay |
| Network timeout | Low | Retry logic with exponential backoff |

---

## Post-POC Next Steps

If POC succeeds:
1. ✅ Proceed with full PRD + SA&D
2. ✅ Design D1 schema for user data
3. ✅ Implement intent recognition with LLM
4. ✅ Add proper error handling & monitoring
5. ✅ Multi-user architecture design

If POC fails:
1. Analyze failure point
2. Consider alternatives (Telegram Bot API, etc.)
3. Pivot or adjust scope

---

## Resources

### Reference Links
- whatsapp-web.js: https://github.com/pedroslopez/whatsapp-web.js
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- POC Code Repository: [To be created]

### Support
- MotherBase+ SuperTeam on standby
- Cloudflare Discord community
- whatsapp-web.js GitHub issues

---

**POC Start Date**: TBD  
**Estimated Completion**: 2 days  
**Owner**: Watson Claw Dev Team  
**Status**: Ready to start

---

*Prepared by MotherBase+ SuperTeam (ARC, EXE, WTH)*
