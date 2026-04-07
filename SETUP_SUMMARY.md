# Quick Setup Summary

This is a condensed version of the deployment setup. For full details, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Server Setup (One-time)

```bash
# 1. Install prerequisites
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm pm2

# 2. Setup PM2 auto-start
pm2 startup
# Run the command that PM2 outputs

# 3. Create app directory
sudo mkdir -p /opt/telegram_bot
sudo chown $USER:$USER /opt/telegram_bot

# 4. Clone repository
cd /opt/telegram_bot
git clone https://github.com/azeiteiro/telegram_bot.git .

# 5. Configure environment
cp .env.example .env
nano .env  # Fill in your production values

# 6. Create logs directory
mkdir -p logs

# 7. Initial deployment
chmod +x deploy.sh
./deploy.sh

# 8. Verify
pm2 status
pm2 logs telegram_festival_bot
```

## GitHub Secrets to Configure

Go to: Repository → Settings → Secrets and variables → Actions

| Secret | Value |
|--------|-------|
| `DO_PRODUCTION_HOST` | Your server IP (e.g., `123.45.67.89`) |
| `DO_PRODUCTION_USER` | SSH user (e.g., `root` or `ubuntu`) |
| `DO_PRODUCTION_SSH_KEY` | Private SSH key content |
| `DO_PRODUCTION_APP_PATH` | `/opt/telegram_bot` |
| `DO_PRODUCTION_PORT` | `22` (optional) |

## Environment Variables (.env)

Minimum required for production:

```bash
NODE_ENV=production
BOT_PRODUCTION_TOKEN=your_bot_token
CHAT_ID=your_chat_id
ADMIN_IDS=[123456789,987654321]
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URL=http://localhost:8080/auth/google/callback
ALBUM_ID=your_album_id
ALBUM_URL=your_album_url
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEET_ID=your_sheet_id
ACCUWEATHER_API_KEY=your_api_key
UPLOAD_TO_GPHOTOS=true
PHOTO_DESCRIPTION="#festival"
```

## Daily Operations

### Deploy
```bash
git push origin master
# Deployment happens automatically via GitHub Actions
```

### Monitor
```bash
ssh your-server
pm2 logs telegram_festival_bot
pm2 monit
```

### Manual Deployment (if needed)
```bash
ssh your-server
cd /opt/telegram_bot
./deploy.sh
```

## Useful PM2 Commands

```bash
pm2 list                              # Show all processes
pm2 logs telegram_festival_bot        # View logs
pm2 restart telegram_festival_bot     # Restart bot
pm2 stop telegram_festival_bot        # Stop bot
pm2 start ecosystem.config.js         # Start bot
pm2 save                              # Save process list
pm2 monit                             # Monitor resources
```

## Troubleshooting Quick Fixes

**Bot not starting?**
```bash
pm2 logs telegram_festival_bot --err
cat .env  # Check environment variables
```

**Deployment failing?**
```bash
# Check file permissions
sudo chown -R $USER:$USER /opt/telegram_bot
chmod +x deploy.sh
```

**OAuth issues?**
```bash
rm .token.json
node --env-file=.env dist/app.js  # Re-authenticate
```

## Pre-Flight Checklist

Before festival week:
- [ ] Test bot in production environment
- [ ] Verify all commands work (`/lineup`, `/info`, `/expense`, etc.)
- [ ] Test photo uploads to Google Photos
- [ ] Test expense logging to Google Sheets
- [ ] Verify weather updates are working
- [ ] Check daily message schedule (9 AM)
- [ ] Confirm admin commands work
- [ ] Monitor logs for errors
- [ ] Set up phone alerts for PM2 crashes (optional)

## Support

- Full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- PM2 docs: https://pm2.keymetrics.io/docs/usage/quick-start/
- GitHub Actions: Repository → Actions tab
