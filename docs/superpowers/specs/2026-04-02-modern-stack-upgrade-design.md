# Modern Stack Upgrade Design

**Date:** 2026-04-02
**Status:** Approved
**Approach:** Modern Stack Upgrade (Approach B)

## Overview

Modernize the Telegram bot's dependency stack to improve performance and reduce package count while maintaining existing application structure. This is an incremental migration following the completed grammY and Jest test implementation.

## Context

- 5-year-old project originally built with Telegraf
- grammY migration and Jest tests already completed on separate branch
- Running on Node 24+ with TypeScript 6
- Deployed via PM2 on Digital Ocean
- Telegraf was 3 versions behind Bot API, now resolved with grammY

## Goals

1. Remove redundant dependencies (nodemon, dotenv)
2. Improve performance (pino logging, tsup builds)
3. Modernize HTTP client (native fetch)
4. Improve job scheduling reliability (Bree)
5. Add proper TypeScript test support

## Architecture

### Package Changes

**Removals:**
- `nodemon` - redundant with `tsx --watch`
- `axios` - replaced by native `fetch` (Node 24 built-in)
- `dotenv` - replaced by native `--env-file` flag (Node 20.6+)
- `winston` - replaced by `pino`
- `node-schedule` - replaced by `Bree`

**Additions:**
- `@types/jest` + `ts-jest` - TypeScript test support
- `pino` + `pino-pretty` - faster logging (3-5x performance)
- `Bree` - reliable job scheduling with worker threads
- `tsup` - modern build tool (faster, bundled output)
- `@grammy/hydrate` - Context hydration for grammY
- `@grammy/auto-retry` - Automatic retry for failed requests

**No changes to:**
- grammY (already migrated)
- Google APIs (@googleapis/sheets, google-auth-library)
- Build pipeline (PM2, GitHub Actions)
- ESLint/Prettier tooling

## Components & File Changes

### 1. Logging System (src/utils/logger.ts)

**Current:** Winston with custom transports and formatters

**Target:**
- Replace winston initialization with pino
- Maintain existing logger interface (info, error, warn, debug)
- Add pino-pretty for development formatting
- Keep separate loggers for different purposes (main, userChat)
- Configure log levels via environment variables

**Changes:**
```typescript
// Before: winston.createLogger(...)
// After: pino({ level: process.env.LOG_LEVEL || 'info' })
```

### 2. HTTP Client (Multiple files)

**Current:** axios for HTTP requests

**Target:**
- Replace axios with native fetch API
- Create utility wrapper for common patterns (error handling, JSON parsing)
- Update any axios usage in Google API integration (verify @googleapis/sheets doesn't depend on it)
- Maintain existing retry logic through grammY's auto-retry plugin

**Files affected:**
- Any file currently importing axios
- src/utils/* if utility functions use HTTP

**Wrapper example:**
```typescript
async function fetchJSON(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

### 3. Job Scheduling (src/utils/utils.ts → src/jobs/*)

**Current:** node-schedule with inline job logic

**Target:**
- Extract job logic into separate files under src/jobs/
- Create src/jobs/dailyMessage.ts for scheduled message logic
- Initialize Bree in src/app.ts
- Configure jobs with human-readable syntax
- Worker threads execute job logic independently

**Structure:**
```
src/jobs/
├── dailyMessage.ts    # Daily message job logic
└── index.ts           # Job registration
```

**Bree initialization:**
```typescript
const bree = new Bree({
  jobs: [{
    name: 'dailyMessage',
    cron: '0 9 * * *',  // 9 AM daily
    path: './jobs/dailyMessage.js'
  }]
});
```

### 4. Environment Configuration (src/app.ts, src/config/environment.ts)

**Current:** dotenv package loads .env file

**Target:**
- Remove `import 'dotenv/config'` from src/app.ts
- Update package.json scripts with `--env-file=.env` flag
- Environment validation logic unchanged
- .env file format unchanged

**Script changes:**
```json
{
  "dev": "tsx --watch --env-file=.env src/app.ts",
  "start": "node --env-file=.env dist/app.js"
}
```

### 5. Build System (root level)

**Current:** TypeScript compiler (tsc) with manual resource copying

**Target:**
- Add tsup.config.ts for build configuration
- Configure ES module output
- Bundle dependencies where appropriate
- Copy resources (src/resources → dist/resources) after build
- Maintain dist/ structure for deployment compatibility

**tsup.config.ts:**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/app.ts'],
  format: ['esm'],
  target: 'node24',
  clean: true,
  sourcemap: true,
  external: ['@googleapis/*', 'telegraf', 'grammy']
});
```

### 6. Testing Setup (root level)

**Current:** Jest configured in package.json

**Target:**
- Add jest.config.ts with ts-jest preset
- Configure TypeScript compilation for tests
- Set up coverage thresholds
- Maintain existing test command

**jest.config.ts:**
```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { lines: 50 }  // Start low, increase over time
  }
};
```

## Data Flow & Migration Strategy

### Migration Order

Execute in this sequence to minimize breakage and enable incremental testing:

1. **Setup phase** (no code changes)
   - Install new packages
   - Add configuration files (tsup.config.ts, jest.config.ts)
   - Commit: "Add new package configs"

2. **Logging migration**
   - Update src/utils/logger.ts
   - Test all log points work correctly
   - Verify log output format
   - Commit: "Migrate winston to pino"

3. **HTTP migration**
   - Create fetch utility wrapper
   - Replace axios calls one file at a time
   - Test each file's HTTP functionality
   - Commit per file or logical group

4. **Build migration**
   - Switch package.json build script to tsup
   - Verify dist/ output structure
   - Test production build
   - Commit: "Migrate to tsup builds"

5. **Environment migration**
   - Remove dotenv import
   - Update package.json scripts
   - Test environment loading
   - Commit: "Use native env-file flag"

6. **Scheduling migration** (last, most isolated)
   - Extract job logic to src/jobs/
   - Configure Bree
   - Test job execution
   - Remove node-schedule
   - Commit: "Migrate to Bree scheduling"

7. **Cleanup phase**
   - Remove old packages from package.json
   - Remove nodemon references
   - Update README if needed
   - Commit: "Remove deprecated packages"

### Data Flow Changes

**Logging:**
- Same call sites → pino instead of winston → same output destinations
- Performance improvement: 3-5x faster log processing
- Same log levels and formatting options

**HTTP:**
- Same request logic → fetch instead of axios → same responses
- Native API, no external dependency
- Simpler error handling (check response.ok)

**Jobs:**
- Same schedule triggers → Bree workers instead of node-schedule callbacks → same bot actions
- Worker thread isolation (failures don't crash main process)
- More reliable execution

**Environment:**
- Same .env file → native loader instead of dotenv → same process.env access
- One less dependency
- Faster startup (no package loading)

**Build:**
- Same source → tsup instead of tsc → optimized dist/
- Faster builds
- Better tree-shaking
- Smaller bundle size

### Unchanged Flows

- Bot message handling (grammY manages this)
- Google Photos uploads
- Google Sheets expense tracking
- Database/API integrations
- User-facing command behavior
- PM2 deployment process

## Error Handling

### Logging Errors

- Pino serializes errors same as winston
- Existing `logger.error(err)` calls work unchanged
- Stack traces preserved in output
- Failed log writes non-blocking (won't crash bot)
- Log rotation and file handling unchanged

### HTTP Errors

**Key difference:** Native fetch doesn't auto-throw on 4xx/5xx

**Solution:**
```typescript
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

**Implementation:**
- Create utility function to wrap fetch with error checking
- Maintain existing error handling patterns in calling code
- Google API client errors unchanged (doesn't use axios internally)

### Scheduling Errors

- Bree has built-in error handling for worker failures
- Configure error callbacks to log via pino
- Failed jobs logged but don't crash main process
- Worker isolation prevents cascading failures
- Existing bot.catch() error handler still catches bot-related errors

### Migration Rollback

- Keep old packages until all tests pass
- Git commit after each migration phase
- Can revert individual changes if issues arise
- Feature flags not needed (changes are isolated)

## Testing Strategy

### Test Setup

**Configuration:**
- jest.config.ts with ts-jest preset
- Coverage thresholds starting at 50% lines
- Existing `yarn test` command unchanged
- Add `yarn test:watch` for development

### Migration Validation Tests

**1. Logging tests**
- Verify pino output format matches expectations
- Test log levels (info, error, warn, debug)
- Ensure error serialization works
- Check log file creation/rotation

**2. HTTP tests**
- Mock fetch responses using jest.spyOn
- Test successful requests
- Test error handling (4xx, 5xx, network errors)
- Verify JSON parsing
- Test fetch utility wrapper

**3. Job tests**
- Test job logic in isolation (without Bree)
- Mock bot commands
- Verify scheduling logic
- Test error handling in jobs

**4. Integration tests**
- Bot starts without errors
- Environment variables load correctly
- Logger initializes properly
- Jobs register with Bree
- grammY middleware chain works

**5. Build tests**
- Verify dist/ output structure
- Test that built app runs
- Check resource files copied correctly
- Validate imports resolve

### Manual Testing Checklist

Execute after each migration phase:

- [ ] Bot starts without errors
- [ ] `/start` command responds
- [ ] `/lineup` command shows correct data
- [ ] `/expense` scene workflow completes
- [ ] Media uploads to Google Photos
- [ ] Scheduled daily message fires at correct time
- [ ] Logs appear in correct format and location
- [ ] Error logging captures stack traces
- [ ] PM2 process management works
- [ ] Environment variables load correctly

### Existing Tests

- grammY tests already written (assumed on branch)
- Should continue passing after migrations
- Add tests for any new wrapper functions
- Update mocks if internal implementations change

### Test Coverage Goals

**Phase 1 (Initial):**
- 50% line coverage minimum
- All critical paths tested (commands, scenes, jobs)

**Phase 2 (Post-migration):**
- Increase to 70% coverage
- Add edge case tests
- Test error scenarios

## Success Criteria

### Functional Requirements

- [ ] All existing bot commands work identically
- [ ] Scheduled jobs fire at correct times
- [ ] Google APIs integrations function correctly
- [ ] Media uploads work
- [ ] Expense tracking scene completes successfully
- [ ] Logs appear in correct format
- [ ] Error handling catches and logs failures

### Non-Functional Requirements

- [ ] Build time improves (tsup faster than tsc)
- [ ] Log performance improves (pino 3-5x faster)
- [ ] Dependencies modernized (5 old packages removed, 8 modern alternatives added)
- [ ] Bundle size reduced (tree-shaking via tsup)
- [ ] No regression in bot response time
- [ ] PM2 deployment process unchanged

### Migration Completeness

- [ ] All 6 migration phases completed
- [ ] All old packages removed from package.json
- [ ] All tests passing
- [ ] Manual testing checklist completed
- [ ] Documentation updated (README, DEPLOYMENT.md)
- [ ] Design spec committed to repo

## Risks & Mitigations

### Risk: fetch API differences from axios

**Impact:** Medium - HTTP calls may fail unexpectedly

**Mitigation:**
- Create comprehensive fetch wrapper utility
- Test error scenarios thoroughly
- Keep axios temporarily for rollback option
- Review all HTTP call sites before removing axios

### Risk: Bree worker thread complexity

**Impact:** Medium - Job scheduling may fail or behave differently

**Mitigation:**
- Test job execution extensively in development
- Keep node-schedule temporarily for rollback
- Add detailed logging in job workers
- Start with one job, validate, then migrate others

### Risk: tsup bundling issues

**Impact:** Low - Build output may not run correctly

**Mitigation:**
- Test built output thoroughly before deployment
- Verify imports resolve correctly
- Check resource file copying
- Keep tsc available for rollback

### Risk: pino logging format differences

**Impact:** Low - Logs may not match existing format

**Mitigation:**
- Configure pino formatters to match winston output
- Test log parsing/monitoring tools
- Document any format changes
- Keep winston config for reference

### Risk: Breaking production deployment

**Impact:** High - Bot goes offline

**Mitigation:**
- Test entire migration in development first
- Deploy to staging environment before production
- Keep previous deployment for quick rollback
- Perform migration during low-usage hours
- Monitor logs closely after deployment

## Timeline Estimate

**Total effort:** ~3.5-4.5 hours for full implementation

**Phase breakdown:**
1. Setup phase: 15 minutes
2. Logging migration: 30 minutes
3. HTTP migration: 45 minutes
4. Build migration: 30 minutes
5. Environment migration: 5 minutes
6. Scheduling migration: 2-3 hours
7. Cleanup: 15 minutes

**Note:** Timeline assumes grammY migration and tests already complete. Testing time additional to implementation.

## Next Steps

1. Review and approve this design spec
2. Create detailed implementation plan via writing-plans skill
3. Execute migration in order specified
4. Run test suite after each phase
5. Deploy to staging for validation
6. Deploy to production

## References

- [pino documentation](https://getpino.io/)
- [Bree documentation](https://github.com/breejs/bree)
- [tsup documentation](https://tsup.egoist.dev/)
- [Node.js --env-file flag](https://nodejs.org/api/cli.html#--env-fileconfig)
- [grammY plugins](https://grammy.dev/plugins/)
