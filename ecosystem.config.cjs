const path = require('path');

module.exports = {
  apps: [
    {
      name: 'telegram_festival_bot',
      script: './dist/app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      node_args: '--env-file=.env',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        UPLOAD_TO_GPHOTOS: 'true',
        PHOTO_DESCRIPTION: '#festival',
        BASE_PATH: '../..',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Restart bot daily at 3 AM (during low activity)
      cron_restart: '0 3 * * *',
    },
  ],
};
