# Deployment Guide

This guide explains how to set up automated deployment to your Digital Ocean server using GitHub Actions.

## Overview

The deployment workflow automatically:
1. Runs quality checks (lint, type check, build)
2. SSHs into your server
3. Pulls latest code, installs dependencies, and builds
4. Restarts the bot using PM2

For manual deployments, a `deploy.sh` script is provided for convenience.

## Production Setup (Digital Ocean)

### 1. Server Prerequisites

SSH into your Digital Ocean droplet and install required software:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2
npm install -g pm2

# Setup PM2 to start on boot
pm2 startup
# Follow the command output to configure startup
```

### 2. Clone Repository

```bash
# Create app directory
sudo mkdir -p /opt/telegram_bot
sudo chown $USER:$USER /opt/telegram_bot

# Clone repository
cd /opt/telegram_bot
git clone https://github.com/azeiteiro/telegram_bot.git .

# Create logs directory
mkdir -p logs
```

### 3. Configure Environment Variables

Create `.env` file on the server:

```bash
cd /opt/telegram_bot
nano .env
```

Add your production configuration (see `.env.example` for all options):

```bash
# Environment
NODE_ENV=production

# Telegram Bot
BOT_PRODUCTION_TOKEN=your_production_bot_token_here
CHAT_ID=-100your_group_id

# Admin IDs (JSON array)
ADMIN_IDS=[123456789,987654321]

# Google API
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URL=http://localhost:8080/auth/google/callback

# Google Photos
UPLOAD_TO_GPHOTOS=true
ALBUM_ID=your_album_id
ALBUM_URL=https://photos.app.goo.gl/your_album
PHOTO_DESCRIPTION="#paredesdecoura2025"

# Google Sheets
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEET_ID=your_sheet_id

# Weather
ACCUWEATHER_API_KEY=your_api_key

# Legacy
BASE_PATH=../..
```

### 4. Google OAuth Authentication

Initial setup requires interactive authentication:

```bash
cd /opt/telegram_bot
pnpm install
pnpm build

# This will open a browser window for OAuth
node --env-file=.env dist/app.js

# Follow the OAuth flow to authorize
# This creates .token.json which will be reused on subsequent runs
```

### 5. Initial Deployment

```bash
cd /opt/telegram_bot
chmod +x deploy.sh
./deploy.sh
```

### 6. Verify Setup

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs telegram_festival_bot

# Verify bot is responding in Telegram
# Send /help command to your bot
```

### 7. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DO_PRODUCTION_HOST` | Digital Ocean droplet IP | `123.45.67.89` |
| `DO_PRODUCTION_USER` | SSH username | `root` or `ubuntu` |
| `DO_PRODUCTION_SSH_KEY` | Private SSH key | Contents of `~/.ssh/id_rsa` |
| `DO_PRODUCTION_PORT` | SSH port (optional) | `22` |
| `DO_PRODUCTION_APP_PATH` | App directory path | `/opt/telegram_bot` |

### Setting Up SSH Key for Deployment

#### Option 1: Use Existing SSH Key (Recommended)

If your server already has SSH access to GitHub, you can reuse that key:

```bash
# On your server
cat ~/.ssh/id_ed25519  # or id_rsa
# Copy the ENTIRE output (including -----BEGIN/END----- lines)
# Add it as DO_PRODUCTION_SSH_KEY in GitHub secrets
```

#### Option 2: Create Dedicated Deployment Key

Create a separate key specifically for GitHub Actions:

```bash
# On your LOCAL machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Copy the private key (this goes to GitHub secrets)
cat ~/.ssh/github_actions_deploy

# Copy the public key to your server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-server
# OR manually:
# cat ~/.ssh/github_actions_deploy.pub
# Then on server: echo "PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
```

## Deployment Workflow

The deployment happens automatically when you:
- Push to the `master` branch
- Manually trigger via GitHub Actions UI (workflow_dispatch)

### Workflow Steps

1. **Quality Checks Job**
   - Checkout code
   - Install dependencies
   - Run linting
   - Run format check
   - Type check with TypeScript
   - Build the project

2. **Deploy Job** (only runs if quality checks pass)
   - SSH into server
   - Pull latest code
   - Install dependencies
   - Build project
   - Restart PM2 process
   - Save PM2 configuration

## Deployment Workflow

The bot deploys automatically when you push to `master`:

```bash
git push origin master
```

After pushing, check GitHub Actions:
1. Go to your repo → Actions tab
2. Watch the "CI - Lint, Type Check, and Build" workflow
3. Watch the "Deploy Production to Digital Ocean" workflow
4. Verify deployment succeeds

On the server:
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs telegram_festival_bot

# Check if bot is running
pm2 describe telegram_festival_bot
```

## Manual Deployment

If you need to deploy manually:

```bash
# SSH into your server
ssh user@your-server

# Run deployment script
cd /opt/telegram_bot
./deploy.sh
```

## PM2 Management

### Useful PM2 Commands

```bash
# View running processes
pm2 list

# View logs
pm2 logs telegram_festival_bot

# View logs in real-time
pm2 logs telegram_festival_bot --lines 100

# Restart bot
pm2 restart telegram_festival_bot

# Stop bot
pm2 stop telegram_festival_bot

# Start bot
pm2 start ecosystem.config.js

# Save current PM2 process list
pm2 save

# Monitor resources
pm2 monit

# Clear logs
pm2 flush
```

### PM2 Configuration

The bot is configured in `ecosystem.config.js` with:
- Automatic restart on crashes
- Memory limit: 500MB (restarts if exceeded)
- Daily restart at 3 AM
- Log files in `./logs/` directory

## Troubleshooting

### Deployment fails with "Host key verification failed"

Add your server's host key to GitHub Actions:

```bash
# On your server
ssh-keyscan your-server-domain.com
# Add the output to your server's ~/.ssh/known_hosts
```

### "Permission denied (publickey)"

1. Verify the SSH key in GitHub secrets is correct (include BEGIN/END lines)
2. Check that the public key is in `~/.ssh/authorized_keys` on the server
3. Verify SSH key permissions on server:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

### Deployment fails with "Permission denied" on files

```bash
# On the server, ensure the app directory is owned by your user
sudo chown -R $USER:$USER /opt/telegram_bot
```

### Bot doesn't start after deployment

Check PM2 logs:
```bash
pm2 logs telegram_festival_bot --lines 50
```

Common issues:
- Missing environment variables (check `.env` file)
- Invalid `.token.json` file (delete and re-authenticate)
- Port already in use
- Node version mismatch

### Environment validation errors

If the bot exits immediately with environment errors:

```bash
# Check your .env file
cat .env

# Verify all required variables are set
# See .env.example for reference

# Test locally
pnpm build
node --env-file=.env dist/app.js
```

## Monitoring

### View Logs

```bash
# Real-time logs
pm2 logs telegram_festival_bot

# Application logs (custom Winston logs)
tail -f logs/app.log
tail -f logs/error.log
tail -f logs/chat.log
```

### Check Bot Status

```bash
pm2 list
pm2 show telegram_festival_bot
```

### GitHub Actions

Monitor deployments in your repository:
- Go to "Actions" tab
- View workflow runs
- Check logs for any failures

## Security Notes

1. **Never commit** `.env`, `.token.json`, or `credentials.json` files
2. **Rotate SSH keys** periodically
3. **Use restrictive file permissions** on the server:
   ```bash
   chmod 600 .env
   chmod 600 .token.json
   ```
4. **Monitor PM2 logs** for any suspicious activity
5. **Keep dependencies updated** (Dependabot will help with this)

## Pre-Deployment Checklist

Before deploying to production:

- [ ] Server prerequisites installed (Node 24, pnpm, PM2)
- [ ] PM2 startup script configured (`pm2 startup`)
- [ ] App directory created at `/opt/telegram_bot`
- [ ] Repository cloned and owned by deployment user
- [ ] All required environment variables set in `.env`
- [ ] Google OAuth tokens configured (`.token.json`)
- [ ] Admin IDs configured correctly in `.env` (JSON array format)
- [ ] `deploy.sh` script is executable (`chmod +x deploy.sh`)
- [ ] GitHub secrets configured (host, user, SSH key, path)
- [ ] SSH access tested manually
- [ ] Initial deployment tested with `./deploy.sh`
- [ ] PM2 process list saved (`pm2 save`)
- [ ] Bot tested in Telegram (send `/help` command)
- [ ] Logs directory exists and is writable

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Digital Ocean Deployment Guide](https://docs.digitalocean.com/products/app-platform/)
