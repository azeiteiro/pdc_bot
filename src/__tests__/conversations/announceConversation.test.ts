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
    session: {} as { pendingBroadcast?: string },
    reply: jest.fn(),
  });

  it('should prompt for the broadcast message and wait for a text reply', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('Hello group');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      'Send the message you want to broadcast to the group (or /cancel to abort).',
    );
    expect(conversation.waitFor).toHaveBeenCalledWith('message:text');
  });

  it('should store the message in session and reply with a preview and keyboard', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('Party tonight at *9pm*!');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.session.pendingBroadcast).toBe('Party tonight at *9pm*!');

    const [message, options] = msgCtx.reply.mock.calls[0];

    expect(message).toContain('Party tonight at *9pm*!');
    expect(options).toEqual(
      expect.objectContaining({
        parse_mode: 'Markdown',
        reply_markup: expect.objectContaining({
          inline_keyboard: [
            [
              expect.objectContaining({ callback_data: 'announce_confirm' }),
              expect.objectContaining({ callback_data: 'announce_confirm_pin' }),
            ],
            [expect.objectContaining({ callback_data: 'announce_cancel' })],
          ],
        }),
      }),
    );
  });

  it('should cancel on /cancel without touching the session', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('/cancel');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.reply).toHaveBeenCalledWith('Broadcast cancelled.');
    expect(msgCtx.session.pendingBroadcast).toBeUndefined();
  });

  it('should cancel on re-issuing /announce as an escape command', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('/announce');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.reply).toHaveBeenCalledWith('Broadcast cancelled.');
    expect(msgCtx.session.pendingBroadcast).toBeUndefined();
  });
});
