# Music Festival Telegram Bot

Welcome to the Music Festival Telegram Bot repository! This bot provides a variety of features to enhance your festival experience.

## Features

- **Alerts about concerts**: Receive real-time alerts for upcoming concerts.
- **Daily message**: Get a daily summary of concerts and weather updates.
- **Festival lineup consultation**: Check the festival lineup at any time.
- **Google Photos integration**: Automatically upload all media sent to the group to a Google Photos album.
- **Google Sheets integration**: Add expenses from a single command into a spreadsheet

## Getting Started

### Prerequisites

- Node 24+
- Yarn package manager
- Telegram Bot API token
- Google Photos API credentials (optional)
- Google Sheets API credentials (optional)
- AccuWeather API Key (optional)

## Tech Stack

This bot uses a modern TypeScript stack:
- **Runtime**: Node 24+
- **Bot Framework**: [grammY](https://grammy.dev/)
- **Build Tool**: [tsup](https://tsup.egoist.dev/) (esbuild-powered)
- **Logging**: [pino](https://getpino.io/) for high-performance structured logging
- **Scheduling**: [Bree](https://github.com/breejs/bree) with worker threads
- **Testing**: [Jest](https://jestjs.io/) with [ts-jest](https://kulshekhar.github.io/ts-jest/)
- **HTTP**: Native Fetch API

### Installation

1. Clone the repository:

   ```sh
   git clone git@github.com:azeiteiro/telegram_bot.git
   cd telegram_bot
   ```

2. Install the required packages:

   ```sh
   yarn install
   ```

3. Set up environment variables:

   Create a `.env` file in the root directory. Check `.env.example` to check variables. The only mandatory varible for the bot to run is the token.

   ```env
   BOT_DEVELOPMENT_TOKEN=your_telegram_api_token
   ```

### Usage

Run the bot:

```sh
yarn dev
```

Compile to production:

```sh
yarn build
yarn start
```

## Deployment

For production deployment to Digital Ocean with automated CI/CD, see [DEPLOYMENT.md](./DEPLOYMENT.md).

The bot uses PM2 for process management and GitHub Actions for automated deployments.
