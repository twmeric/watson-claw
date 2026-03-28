# 🦞 Watson Claw

> WhatsApp AI Assistant for University Students
> 
> Powered by Cloudflare Workers | SaleSmartly | CloudWapi

## 🚀 Quick Start

```bash
# 1. Clone and setup
git clone <repo-url>
cd watson-claw
npm run setup

# 2. Configure environment
copy .dev.vars.example .dev.vars
# Edit .dev.vars with your API keys

# 3. Start development
npm run dev

# 4. Test
curl http://localhost:8787/health
```

## 🏗️ Architecture

```
User (WhatsApp) → SaleSmartly → Cloudflare Worker → CloudWapi → User
                          ↓
                    Cloudflare D1 (Database)
```

## 📁 Project Structure

```
watson-claw/
├── .github/workflows/     # CI/CD automation
├── scripts/               # Deployment scripts
├── src/
│   ├── handlers/          # Request handlers
│   │   ├── webhook.js     # SaleSmartly webhook
│   │   ├── cron.js        # Scheduled tasks
│   │   └── health.js      # Health checks
│   ├── services/          # Business logic
│   │   ├── db.js          # Database operations
│   │   ├── llm.js         # OpenRouter LLM
│   │   └── whatsapp.js    # CloudWapi messaging
│   ├── utils/             # Utilities
│   │   └── security.js    # Security helpers
│   └── index.js           # Worker entry
├── migrations/            # Database migrations
└── tests/                 # Test files
```

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run dev:staging` | Test with staging config |
| `npm run deploy` | Deploy to production |
| `npm run deploy:staging` | Deploy to staging |
| `npm run db:migrate` | Apply database migrations |
| `npm run test` | Run tests |
| `npm run lint` | Run linter |

## 🔄 CI/CD

### Automatic Deployments

| Branch | Environment | Trigger |
|--------|-------------|---------|
| `main` | Production | Push + Manual approval |
| `develop` | Staging | Auto on push |
| `feature/*` | PR Preview | Auto on PR |

## 🔐 Environment Variables

```bash
# SaleSmartly
SALESMARTLY_SECURITY_CODE=xxx

# CloudWapi
CLOUDWAPI_KEY=xxx

# OpenRouter
OPENROUTER_API_KEY=xxx

# Cloudflare (in wrangler.toml)
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx
```

## 📄 License

MIT License - See LICENSE file
