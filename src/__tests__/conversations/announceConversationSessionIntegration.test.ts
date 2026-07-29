import { describe, it, expect } from '@jest/globals';
import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import type { Update, UserFromGetMe, StorageAdapter } from 'grammy';
import type { BotContext, SessionData } from '../../types/types.js';
import { announceConversation } from '../../conversations/announceConversation.js';

/**
 * Drives the REAL @grammyjs/conversations engine (not mocked) through
 * sequential updates — entering `announceConversation`, replying with the
 * broadcast text, then a plain follow-up update — to guard against two bugs
 * found in production:
 *
 *   1. `TypeError: Cannot set properties of undefined (setting 'pendingBroadcast')`
 *
 *      Root cause: `createConversation` builds its internal `wait`/`waitFor`
 *      context objects from scratch on every single invocation of the
 *      conversation builder (including the very first one) — they never pass
 *      through the bot's real middleware stack, so plain context properties
 *      like `ctx.session` are not present on them.
 *
 *   2. "Nothing pending — this broadcast was already sent or cancelled."
 *
 *      A tempting-looking fix for (1) is to re-install `session()` on the
 *      conversation via the `plugins` option and mutate `msgCtx.session`
 *      directly. That avoids the crash, but with a REAL (serializing) storage
 *      backend it introduces a silent data-loss bug: the conversation's own
 *      nested session reads storage, resolves its `next()` immediately
 *      (before the conversation body runs), and writes back right away — a
 *      no-op snapshot. The mutation made afterwards is never persisted, and
 *      the OUTER session (wrapping the whole update) then writes back LAST
 *      with its own stale, pre-mutation snapshot, clobbering anything that
 *      might have been written. A naive in-memory `Map` storage stub that
 *      returns the *same object reference* on every `read()` masks this bug
 *      entirely, so the storage stub here intentionally JSON round-trips on
 *      every read/write, mirroring the real `createSqliteStorage` adapter.
 *
 *      The correct fix — used by `announceConversation` — is
 *      `conversation.external()`, which hands its callback the real, live
 *      outer context for the current update: the one whose own session
 *      write-back will naturally persist the mutation, with no nested
 *      session cycle involved and no `plugins` option needed.
 */

const FAKE_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

const FAKE_ME: UserFromGetMe = {
  id: 42,
  is_bot: true,
  first_name: 'Test',
  username: 'test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
};

// Stub every outgoing Bot API call so tests never touch the network.
const fakeFetch = (async () =>
  new Response(JSON.stringify({ ok: true, result: {} }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch;

function makeUpdate(updateId: number, text: string): Update {
  const isCommand = text.startsWith('/');

  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: 1, type: 'private', first_name: 'Admin' },
      from: { id: 1, is_bot: false, first_name: 'Admin' },
      text,
      ...(isCommand ? { entities: [{ type: 'bot_command', offset: 0, length: text.length }] } : {}),
    },
  } as Update;
}

function initial(): SessionData {
  return { expenseData: undefined };
}

/**
 * Storage stub that JSON round-trips on every read/write — like the real
 * `createSqliteStorage` adapter — so `read()` never returns the same object
 * reference twice. A naive `Map`-based stub without this round-trip would
 * mask the session write-ordering bug described above.
 */
function createJsonRoundTrippingStorage<T>(): StorageAdapter<T> {
  const rawStore = new Map<string, string>();

  return {
    read: (key: string) => {
      const raw = rawStore.get(key);

      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    },
    write: (key: string, value: T) => {
      rawStore.set(key, JSON.stringify(value));
    },
    delete: (key: string) => {
      rawStore.delete(key);
    },
  };
}

/**
 * Builds a bot wired up exactly like `mainBot.ts`: real session middleware
 * backed by a JSON round-tripping storage adapter, real conversations plugin,
 * and `announceConversation` registered with no `plugins` option.
 */
function makeBot() {
  const bot = new Bot<BotContext>(FAKE_TOKEN, { client: { fetch: fakeFetch } });

  bot.botInfo = FAKE_ME;

  const storage = createJsonRoundTrippingStorage<SessionData>();

  bot.use(session({ initial, storage }));
  bot.use(conversations());

  bot.use(
    createConversation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      announceConversation as any,
      'announceConversation',
    ),
  );

  bot.command('enter', async (ctx) => {
    await ctx.conversation.enter('announceConversation');
  });

  let lastCheckedPendingBroadcast: string | undefined;

  bot.command('check', async (ctx) => {
    lastCheckedPendingBroadcast = ctx.session.pendingBroadcast;
  });

  return { bot, getLastCheckedPendingBroadcast: () => lastCheckedPendingBroadcast };
}

describe('announceConversation + session integration', () => {
  it('does not throw when replying inside the conversation', async () => {
    const { bot } = makeBot();

    await bot.handleUpdate(makeUpdate(1, '/enter'));

    await expect(bot.handleUpdate(makeUpdate(2, 'Hello group'))).resolves.not.toThrow();
  });

  it('sets and persists pendingBroadcast via conversation.external(), visible to a later update', async () => {
    const { bot, getLastCheckedPendingBroadcast } = makeBot();

    await bot.handleUpdate(makeUpdate(1, '/enter'));
    await bot.handleUpdate(makeUpdate(2, 'Hello group'));

    await bot.handleUpdate(makeUpdate(3, '/check'));
    expect(getLastCheckedPendingBroadcast()).toBe('Hello group');
  });
});
