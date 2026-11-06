import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const handler = require('../api/tts.js');

function makeResponse() {
  return {
    code: 200, headers: {}, body: null,
    setHeader(k,v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    end() { return this; }
  };
}
async function call(method, body, ip) {
  const res = makeResponse();
  await handler({ method, body, headers: { 'x-forwarded-for': ip }, socket: {} }, res);
  return res;
}
const oldFetch = globalThis.fetch;
try {
  let calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url) === 'https://freetts.org/api/tts') {
      return {
        ok: true, status: 200,
        async json() { return { file_id: 'a3f7c012-58b4-4e2a-9d1c-0f83abc12345' }; }
      };
    }
    return {
      ok: true, status: 200,
      headers: { get(name) { return name === 'content-type' ? 'audio/mpeg' : null; } },
      async arrayBuffer() { return Uint8Array.from([73,68,51,4,5,6,7,8]).buffer; }
    };
  };

  let res = await call('OPTIONS', {}, 'test-options');
  assert.equal(res.code, 204);
  res = await call('GET', {}, 'test-get');
  assert.equal(res.code, 405);

  res = await call('POST', { text: 'English test', voice: 'en-GB-SoniaNeural', language: 'en-GB', rate: 0.95 }, 'test-en');
  assert.equal(res.code, 200);
  assert.equal(res.headers['content-type'], 'audio/mpeg');
  assert.equal(res.body.length, 8);
  assert.equal(calls[0].url, 'https://freetts.org/api/tts');
  assert.equal(JSON.parse(calls[0].options.body).voice, 'en-GB-SoniaNeural');
  assert.equal(JSON.parse(calls[0].options.body).rate, '-5%');
  assert.equal(calls[1].url, 'https://freetts.org/api/audio/a3f7c012-58b4-4e2a-9d1c-0f83abc12345');

  res = await call('POST', { text: 'اختبار اللغة العربية', voice: 'ar-EG-SalmaNeural', language: 'ar-EG' }, 'test-ar');
  assert.equal(res.code, 200);
  assert.equal(JSON.parse(calls[2].options.body).voice, 'ar-EG-SalmaNeural');

  const beforePrivate = calls.length;
  res = await call('POST', { text: 'أهلاً عبودي', voice: 'ar-EG-SalmaNeural', language: 'ar-EG' }, 'test-private');
  assert.equal(res.code, 400);
  assert.equal(res.body.code, 'PERSONAL_TEXT_BLOCKED');
  assert.equal(calls.length, beforePrivate);

  res = await call('POST', { text: 'Locale mismatch', voice: 'ar-EG-SalmaNeural', language: 'en-GB' }, 'test-mismatch');
  assert.equal(res.code, 400);
  res = await call('POST', { text: 'Unknown voice', voice: 'not-a-voice', language: 'en-GB' }, 'test-voice');
  assert.equal(res.code, 400);
  res = await call('POST', { text: 'x'.repeat(1001), voice: 'en-GB-SoniaNeural', language: 'en-GB' }, 'test-length');
  assert.equal(res.code, 400);

  const beforePhoneme = calls.length;
  res = await call('POST', { text: 'a', voice: 'en-GB-SoniaNeural', language: 'en-GB', phoneme: 'æ' }, 'test-phoneme');
  assert.equal(res.code, 422);
  assert.equal(res.body.code, 'PHONEME_UNSUPPORTED');
  assert.equal(calls.length, beforePhoneme);

  globalThis.fetch = async () => ({ ok: false, status: 429, headers: { get(name) { return name === 'retry-after' ? '20' : null; } } });
  res = await call('POST', { text: 'Provider limit test', voice: 'en-GB-SoniaNeural', language: 'en-GB' }, 'test-provider-limit');
  assert.equal(res.code, 429);
  assert.equal(res.headers['retry-after'], '20');

  globalThis.fetch = async () => ({
    ok: true, status: 200, async json() { return { file_id: 'not-a-valid-id' }; }
  });
  res = await call('POST', { text: 'Invalid audio id', voice: 'en-GB-SoniaNeural', language: 'en-GB' }, 'test-invalid-audio-id');
  assert.equal(res.code, 502);
  assert.equal(res.body.code, 'INVALID_AUDIO_REFERENCE');

  console.log('FreeTTS API tests passed: method handling, English, Arabic, MP3 proxy, rate conversion, privacy guard, validation, IPA fallback handling, provider 429, and invalid audio reference.');
} finally {
  globalThis.fetch = oldFetch;
}
