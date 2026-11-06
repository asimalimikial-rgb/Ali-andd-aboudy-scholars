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
const oldKey = process.env.GEMINI_API_KEY;
const oldFetch = globalThis.fetch;
try {
  process.env.GEMINI_API_KEY = 'test-key';
  let res = await call('OPTIONS', {}, 'test-options');
  assert.equal(res.code, 204);
  res = await call('GET', {}, 'test-get');
  assert.equal(res.code, 405);

  let sent = null;
  globalThis.fetch = async (url, options) => {
    sent = { url: String(url), body: JSON.parse(options.body), key: options.headers['x-goog-api-key'] };
    return {
      ok: true, status: 200, headers: { get() { return null; } },
      async json() {
        return { candidates: [{ content: { parts: [{ inlineData: {
          mimeType: 'audio/L16;rate=24000;channels=1',
          data: Buffer.from([1,2,3,4]).toString('base64')
        }}]}}]};
      }
    };
  };

  res = await call('POST', { text: 'English test', voice: 'en-GB-Chirp3-HD-Aoede', language: 'en-GB' }, 'test-en');
  assert.equal(res.code, 200);
  assert.equal(res.headers['content-type'], 'audio/wav');
  assert.equal(res.body.subarray(0,4).toString('ascii'), 'RIFF');
  assert.match(sent.url, /gemini-3\.8-flash-lite-tts:generateContent/);
  assert.equal(sent.body.generationConfig.speechConfig.languageCode, 'en-GB');
  assert.equal(sent.key, 'test-key');

  res = await call('POST', { text: 'اختبار اللغة العربية', voice: 'ar-XA-Chirp3-HD-Aoede', language: 'ar-XA' }, 'test-ar');
  assert.equal(res.code, 200);
  assert.equal(sent.body.generationConfig.speechConfig.languageCode, 'ar-XA');

  const before = sent.url;
  res = await call('POST', { text: 'أهلاً عبودي', voice: 'ar-XA-Chirp3-HD-Aoede', language: 'ar-XA' }, 'test-private');
  assert.equal(res.code, 400);
  assert.equal(res.body.code, 'PERSONAL_TEXT_BLOCKED');
  assert.equal(sent.url, before);

  res = await call('POST', { text: 'Mismatch', voice: 'ar-XA-Chirp3-HD-Aoede', language: 'en-GB' }, 'test-mismatch');
  assert.equal(res.code, 400);
  console.log('TTS API tests passed: method handling, English, Arabic, PCM/WAV conversion, privacy guard, and locale validation.');
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = oldKey;
}
