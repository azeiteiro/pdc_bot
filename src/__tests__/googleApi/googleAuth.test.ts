import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Define common mocks for OAuth2Client
const mockGetToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockGenerateAuthUrl = jest.fn();
const mockOn = jest.fn();
const mockGetAccessToken = jest.fn();

const mockOAuth2ClientInstance = {
  getToken: mockGetToken,
  setCredentials: mockSetCredentials,
  generateAuthUrl: mockGenerateAuthUrl,
  on: mockOn,
  getAccessToken: mockGetAccessToken,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  credentials: {} as any,
};

// 1. Mock fs
jest.unstable_mockModule('fs', () => {
  const fsMock = {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    chmodSync: jest.fn(),
    mkdirSync: jest.fn(),
  };

  return {
    ...fsMock,
    default: fsMock,
  };
});

// 2. Mock http
const mockTerminate = jest.fn().mockResolvedValue(true as never);
const mockServer = {
  listen: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn(),
};

jest.unstable_mockModule('http', () => {
  const httpMock = {
    createServer: jest.fn(() => mockServer),
  };

  return {
    ...httpMock,
    default: httpMock,
  };
});

// 3. Mock http-terminator
jest.unstable_mockModule('http-terminator', () => ({
  createHttpTerminator: jest.fn().mockReturnValue({
    terminate: mockTerminate,
  }),
}));

// 4. Mock open
jest.unstable_mockModule('open', () => ({
  default: jest.fn().mockResolvedValue({ unref: jest.fn() } as never),
}));

// 5. Mock google-auth-library
jest.unstable_mockModule('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => mockOAuth2ClientInstance),
}));

// 6. Mock logger
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Helper to wait for event loop ticks
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('googleAuth', () => {
  const originalEnv = { ...process.env };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getOAuth2Client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let verifyAutentication: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fs: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let http: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-id',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      GOOGLE_REDIRECT_URL: 'http://localhost/callback',
    };

    mockOAuth2ClientInstance.credentials = {};

    // Use cache buster for fresh singleton
    const cacheBuster = Math.random().toString(36).substring(7);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authMod: any = await import(`../../googleApi/googleAuth.js?update=${cacheBuster}`);

    getOAuth2Client = authMod.getOAuth2Client;
    verifyAutentication = authMod.verifyAutentication;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fsMod: any = await import('fs');

    fs = fsMod.default;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const httpMod: any = await import('http');

    http = httpMod.default;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw error if environment variables are missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).GOOGLE_CLIENT_ID = undefined;
    await expect(getOAuth2Client()).rejects.toThrow('Google OAuth credentials missing');
  });

  it('should load tokens from file if .token.json exists', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ access_token: 'stored-token' }));
    mockOAuth2ClientInstance.credentials = { access_token: 'stored-token' };

    const client = await getOAuth2Client();

    expect(fs.existsSync).toHaveBeenCalledWith('.token.json');
    expect(mockSetCredentials).toHaveBeenCalledWith({ access_token: 'stored-token' });
    expect(client).toBe(mockOAuth2ClientInstance);
  });

  it('should handle errors when saving tokens to file', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ access_token: 'old' }));
    mockOAuth2ClientInstance.credentials = { access_token: 'old' };
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Write Fail');
    });

    await getOAuth2Client();
    const tokensListener = mockOn.mock.calls.find((call) => call[0] === 'tokens')?.[1] as (
      tokens: unknown,
    ) => void;

    tokensListener({ access_token: 'new' });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should start browser flow if tokens are missing', async () => {
    fs.existsSync.mockReturnValue(false);
    mockGenerateAuthUrl.mockReturnValue('http://auth-url');
    mockGetToken.mockResolvedValue({ tokens: { access_token: 'new-token' } } as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let serverHandler: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockServerObj: any = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listen: jest.fn().mockImplementation((port, cb: any): any => {
        if (cb) setTimeout(cb, 0);

        return mockServerObj;
      }),
      on: jest.fn().mockReturnThis(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    http.createServer.mockImplementation((handler: any) => {
      serverHandler = handler;

      return mockServerObj;
    });

    const clientPromise = getOAuth2Client();

    await flushPromises();

    const mockReq = { url: '/auth/google/callback?code=12345' };
    const mockRes = { end: jest.fn() };

    await serverHandler(mockReq, mockRes);

    await clientPromise;

    expect(mockGetToken).toHaveBeenCalledWith('12345');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '.token.json',
      expect.stringContaining('new-token'),
    );
  });

  it('should handle refresh token events', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({ access_token: 'old', refresh_token: 'refresh' }),
    );
    mockOAuth2ClientInstance.credentials = { access_token: 'old', refresh_token: 'refresh' };

    await getOAuth2Client();
    const tokensListener = mockOn.mock.calls.find((call) => call[0] === 'tokens')?.[1] as (
      tokens: unknown,
    ) => void;

    tokensListener({ access_token: 'new' });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '.token.json',
      expect.stringContaining('"access_token": "new"'),
    );
  });

  describe('verifyAutentication', () => {
    it('should check access token successfully', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ access_token: 'valid' }));
      mockOAuth2ClientInstance.credentials = { access_token: 'valid' };
      mockGetAccessToken.mockResolvedValue({ token: 'valid' } as never);

      await verifyAutentication();
      expect(mockGetAccessToken).toHaveBeenCalled();
    });
  });
});
