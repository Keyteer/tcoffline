import { api, APIError, setOnUnauthorized } from '../api';
import { auth } from '../auth';
import { localStore } from '../localStore';
import { setServerUrl, clearServerUrl } from '../serverConfig';
import { installInMemoryAsyncStorage } from './_inMemoryStorage';

beforeEach(async () => {
  jest.clearAllMocks();
  installInMemoryAsyncStorage();
  await clearServerUrl();
  await setServerUrl('http://test.local:8000');
  await auth.logout();
});

// ---------------------------------------------------------------------------
// APIError
// ---------------------------------------------------------------------------

describe('APIError', () => {
  it('captures status, message, and data', () => {
    const err = new APIError(404, 'Not found', { detail: 'gone' });
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.data).toEqual({ detail: 'gone' });
    expect(err.name).toBe('APIError');
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSequence(...responses: Array<Partial<Response> | (() => Partial<Response>)>) {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockImplementationOnce(() =>
      Promise.resolve(typeof r === 'function' ? r() : r),
    );
  }
  global.fetch = fn as any;
  return fn;
}

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: () => Promise.resolve(body) as any,
  };
}

// ---------------------------------------------------------------------------
// verifyCredentials — login happy path
// ---------------------------------------------------------------------------

describe('api.verifyCredentials', () => {
  it('stores tokens and returns the user on success', async () => {
    mockFetchSequence(
      jsonResponse(200, { access_token: 'AT', refresh_token: 'RT' }),
      jsonResponse(200, { id: 1, username: 'doc', role: 'user' }),
    );

    const user = await api.verifyCredentials({ username: 'doc', password: 'p' });

    expect(user).toEqual({ id: 1, username: 'doc', role: 'user' });
    expect(auth.getAccessToken()).toBe('AT');
    expect(auth.getRefreshToken()).toBe('RT');
  });

  it('throws APIError on bad credentials', async () => {
    mockFetchSequence(jsonResponse(401, { detail: 'bad creds' }));
    await expect(
      api.verifyCredentials({ username: 'doc', password: 'wrong' }),
    ).rejects.toMatchObject({ status: 401, message: 'bad creds' });
  });
});

// ---------------------------------------------------------------------------
// fetchWithAuth: 401 → refresh → retry
// ---------------------------------------------------------------------------

describe('fetchWithAuth (via api.getCurrentUser)', () => {
  it('refreshes token on 401 and retries once', async () => {
    await auth.setTokens('expired-AT', 'valid-RT');

    const fetchMock = mockFetchSequence(
      jsonResponse(401, { detail: 'expired' }),
      jsonResponse(200, { access_token: 'new-AT', refresh_token: 'new-RT' }),
      jsonResponse(200, { id: 1, username: 'doc', role: 'user' }),
    );

    const user = await api.getCurrentUser();
    expect(user.username).toBe('doc');
    expect(auth.getAccessToken()).toBe('new-AT');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Retry must use the new bearer token
    const retryCall = fetchMock.mock.calls[2];
    const retryHeaders = (retryCall[1] as RequestInit).headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-AT');
  });

  it('logs out and calls onUnauthorized when refresh fails', async () => {
    await auth.setTokens('expired-AT', 'bad-RT');
    const onUnauth = jest.fn();
    setOnUnauthorized(onUnauth);

    mockFetchSequence(
      jsonResponse(401, { detail: 'expired' }),
      jsonResponse(401, { detail: 'refresh failed' }),
    );

    await expect(api.getCurrentUser()).rejects.toMatchObject({ status: 401 });
    expect(auth.getAccessToken()).toBeNull();
    expect(onUnauth).toHaveBeenCalled();

    setOnUnauthorized(() => {});
  });

  it('throws APIError with parsed detail for non-401 errors', async () => {
    await auth.setTokens('AT', 'RT');
    mockFetchSequence(jsonResponse(404, { detail: 'user not found' }));

    await expect(api.getCurrentUser()).rejects.toMatchObject({
      status: 404,
      message: 'user not found',
    });
  });

  it('joins validation-error arrays into a single message', async () => {
    await auth.setTokens('AT', 'RT');
    mockFetchSequence(
      jsonResponse(422, {
        detail: [
          { msg: 'field required', loc: ['body', 'a'] },
          { msg: 'must be int' },
        ],
      }),
    );

    await expect(api.getCurrentUser()).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('field required'),
    });
  });
});

// ---------------------------------------------------------------------------
// store-first behaviour (via api.getEpisodes)
// ---------------------------------------------------------------------------

describe('store-first reads', () => {
  it('returns local data immediately and refreshes in background', async () => {
    await auth.setTokens('AT', 'RT');

    // Pre-seed the local store
    const cached = [{ id: 1, num_episodio: 'CACHED' }] as any;
    await localStore.setEpisodes(cached);

    // Fresh server response with different data
    let resolveFetch!: (v: Response) => void;
    const fetchPromise = new Promise<Response>((r) => {
      resolveFetch = r;
    });
    global.fetch = jest.fn(() => fetchPromise) as any;

    const onUpdate = jest.fn();
    const result = await api.getEpisodes(undefined, onUpdate);

    // Immediate return is the cached value
    expect(result).toEqual(cached);
    expect(onUpdate).not.toHaveBeenCalled();

    // Now resolve the background fetch with fresh data
    const fresh = [{ id: 2, num_episodio: 'FRESH' }];
    resolveFetch(jsonResponse(200, fresh) as Response);

    // Let the background promise chain flush
    await new Promise((r) => setImmediate(r));

    expect(onUpdate).toHaveBeenCalledWith(fresh);
    expect(await localStore.getEpisodes()).toEqual(fresh);
  });

  it('keeps local data when background fetch fails', async () => {
    await auth.setTokens('AT', 'RT');
    const cached = [{ id: 1, num_episodio: 'KEEP' }] as any;
    await localStore.setEpisodes(cached);

    global.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as any;

    const onUpdate = jest.fn();
    const result = await api.getEpisodes(undefined, onUpdate);

    expect(result).toEqual(cached);
    await new Promise((r) => setImmediate(r));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(await localStore.getEpisodes()).toEqual(cached);
  });

  it('skips local store for filtered queries', async () => {
    await auth.setTokens('AT', 'RT');
    const filtered = [{ id: 9, num_episodio: 'FILT' }];
    mockFetchSequence(jsonResponse(200, filtered));

    const result = await api.getEpisodes({ type: 'Hospitalizado' });
    expect(result).toEqual(filtered);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('type=Hospitalizado');
  });
});
