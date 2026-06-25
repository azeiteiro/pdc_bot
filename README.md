
# Music Festival Telegram Bot

[![CI](https://github.com/azeiteiro/pdc_bot/actions/workflows/lint-and-format.yml/badge.svg)](https://github.com/azeiteiro/pdc_bot/actions)
[![Coverage Status](https://coveralls.io/repos/github/azeiteiro/pdc_bot/badge.svg?branch=master)](https://coveralls.io/github/azeiteiro/pdc_bot?branch=master)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightsalmon.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![grammY](https://img.shields.io/badge/grammY-Bot_Framework-mediumslateblue)](https://grammy.dev)

Welcome to the Music Festival Telegram Bot repository! This bot provides a variety of features to enhance your festival experience.

## Features

- **Alerts about concerts**: Receive real-time alerts for upcoming concerts.
- **Daily message**: Get a daily summary of concerts and weather updates.
- **Festival lineup consultation**: Check the festival lineup at any time.
- **Google Photos integration**: Automatically upload all media sent to the group to a Google Photos album.
- **Google Sheets integration**: Add expenses from a single command into a spreadsheet
- **Onboarding 2026**: Automated registration system for festival attendees with payment confirmation and group invite management
- **Offboarding**: Admin-triggered commands to notify attendees when the festival ends, share individual expense balances, and send final payment instructions

## Getting Started

### Prerequisites

- Node 24+
- pnpm package manager
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
   git clone git@github.com:azeiteiro/pdc_bot.git
   cd pdc_bot
   ```

2. Install the required packages:

   ```sh
   pnpm install
   ```

3. Set up environment variables:

   Create a `.env` file in the root directory. Check `.env.example` to check variables. The only mandatory varible for the bot to run is the token.

   ```env
   BOT_DEVELOPMENT_TOKEN=your_telegram_api_token
   ```

### Usage

Run the bot:

```sh
pnpm dev
```

Compile to production:

```sh
pnpm build
pnpm start
```

### Onboarding Setup

Before using the onboarding feature:

1. Create an "Onboarding 2026" sheet tab in your Google Spreadsheet with columns:
   `Nome | Data chegada | Data de partida | Leva carro? | Local partida | Tenda entregue | Observações`

2. Add the spreadsheet ID and sheet tab name to your `.env` file:
   ```env
   ONBOARDING_SPREADSHEET_ID=your_spreadsheet_id_here
   ONBOARDING_SHEET_ID=your_sheet_tab_name_here
   ```

3. Ensure the bot is an admin in the target group with "Invite users" permission

4. Set the group chat ID:
   ```env
   GROUP_CHAT_ID=your_group_chat_id
   ```

### Offboarding Setup

Before using the offboarding commands (`/offboarding2`, `/offboarding3`):

1. Create a sheet tab in your Google Spreadsheet with two columns: `user_id | amount`
   - Positive amount = user receives money
   - Negative amount = user owes money

2. Add the spreadsheet ID and sheet tab name to your `.env` file:
   ```env
   OFFBOARDING_SPREADSHEET_ID=your_spreadsheet_id_here
   OFFBOARDING_SHEET_ID=your_sheet_tab_name
   ```

These variables are optional at startup — the bot will warn but won't crash if they are missing.

## Deployment

For production deployment to Digital Ocean with automated CI/CD, see [DEPLOYMENT.md](./DEPLOYMENT.md).

The bot uses PM2 for process management and GitHub Actions for automated deployments.
