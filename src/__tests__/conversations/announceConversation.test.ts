import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';

const { announceConversation } = await import('../../conversations/announceConversation.js');

describe('announceConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockCtx = () => ({
    reply: jest.fn(),
  });

  const createMockMsgCtx = (text: string) => ({
    message: { text },
    reply: jest.fn(),
  });

  // Simulates the real outer context for the current update, which is what
  // `conversation.external()` hands to its callback in production.
  const createOuterCtx = () => ({
    session: {} as { pendingBroadcast?: string },
  });

  const createMockConversation = (
    msgCtx: unknown,
    outerCtx: ReturnType<typeof createOuterCtx>,
  ) => ({
    waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    external: jest.fn(async (task: (ctx: ReturnType<typeof createOuterCtx>) => unknown) =>
      task(outerCtx),
    ),
  });

  it('should prompt for the broadcast message and wait for a text reply', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('Hello group');
    const outerCtx = createOuterCtx();
    const conversation = createMockConversation(msgCtx, outerCtx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      'Send the message you want to broadcast to the group (or /cancel to abort).',
    );
    expect(conversation.waitFor).toHaveBeenCalledWith('message:text');
  });

  it('should store the message in session via conversation.external and reply with a preview and keyboard', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('Party tonight at *9pm*!');
    const outerCtx = createOuterCtx();
    const conversation = createMockConversation(msgCtx, outerCtx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(conversation.external).toHaveBeenCalledTimes(1);
    expect(outerCtx.session.pendingBroadcast).toBe('Party tonight at *9pm*!');

    const [message, options] = msgCtx.reply.mock.calls[0];

    expect(message).toContain('Party tonight at *9pm*!');
    expect(options).toEqual({
      reply_markup: expect.objectContaining({
        inline_keyboard: [
          [
            expect.objectContaining({ callback_data: 'announce_confirm' }),
            expect.objectContaining({ callback_data: 'announce_confirm_pin' }),
          ],
          [expect.objectContaining({ callback_data: 'announce_cancel' })],
        ],
      }),
    });
  });

  it('should cancel on /cancel without touching the session', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('/cancel');
    const outerCtx = createOuterCtx();
    const conversation = createMockConversation(msgCtx, outerCtx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.reply).toHaveBeenCalledWith('Broadcast cancelled.');
    expect(conversation.external).not.toHaveBeenCalled();
    expect(outerCtx.session.pendingBroadcast).toBeUndefined();
  });

  it('should cancel on re-issuing /announce as an escape command', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('/announce');
    const outerCtx = createOuterCtx();
    const conversation = createMockConversation(msgCtx, outerCtx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.reply).toHaveBeenCalledWith('Broadcast cancelled.');
    expect(conversation.external).not.toHaveBeenCalled();
    expect(outerCtx.session.pendingBroadcast).toBeUndefined();
  });
});
