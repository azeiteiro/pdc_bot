#!/bin/bash
set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Pull latest code
echo "📥 Pulling latest code from git..."
git fetch origin
git reset --hard origin/master

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Build the bot
echo "🔨 Building the project..."
NODE_OPTIONS="--max-old-space-size=2048" pnpm build

# Create logs directory if it doesn't exist
echo "📝 Ensuring logs directory exists..."
mkdir -p logs

# Restart bot with PM2
echo "♻️  Restarting bot with PM2..."
if pm2 describe telegram_festival_bot > /dev/null 2>&1; then
  echo "   Stopping and deleting existing process to apply node_args..."
  pm2 delete telegram_festival_bot
fi

echo "   Starting new process..."
pm2 start ecosystem.config.cjs

# Save PM2 process list (for auto-restart on server reboot)
echo "💾 Saving PM2 process list..."
pm2 save

# Show status
echo "✅ Deployment complete!"
echo ""
echo "📊 Current status:"
pm2 list

echo ""
echo "📋 View logs with: pm2 logs telegram_festival_bot"
