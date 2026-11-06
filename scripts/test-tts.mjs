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
const oldKey = process.env.AZURE_SPEECH_KEY;
const oldRegion = process.env.AZURE_SPEECH_REGION;
const oldFetch = globalThis.fetch;
try {
  process.env.AZURE_SPEECH_KEY = 'test-azure-key';
  process.env.AZURE_SPEECH_REGION = 'uaenorth';
  let res = await call('OPTIONS', {}, 'test-options');
  assert.equal(res.code, 204);
  res = await call('GET', {}, 'test-get');
  assert.equal(res.code, 405);

  let sent = null;
  globalThis.fetch = async (url, options) => {
    sent = { url: String(url), options };
    return {
      ok: true, status: 200, headers: { get() { return null; } },
      async arrayBuffer() { return Uint8Array.from([73,68,51,4,5,6,7,8]).buffer; }
    };
  };

  res = await call('POST', { text: 'English test', voice: 'en-GB-SoniaNeural', language: 'en-GB', rate: 0.95 }, 'test-en');
  assert.equal(res.code, 200);
  assert.equal(res.headers['content-type'], 'audio/mpeg');
  assert.equal(res.body.length, 8);
  assert.equal(sent.url, 'https://uaenorth.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(sent.options.headers['Ocp-Apim-Subscription-Key'], 'test-azure-key');
  assert.equal(sent.options.headers['Content-Type'], 'application/ssml+xml');
  assert.match(sent.options.body, /en-GB-SoniaNeural/);
  assert.match(sent.options.body, /English test/);

  res = await call('POST', { text: 'اختبار اللغة العربية', voice: 'ar-EG-SalmaNeural', language: 'ar-EG' }, 'test-ar');
  assert.equal(res.code, 200);
  assert.match(sent.options.body, /xml:lang="ar-EG"/);
  assert.match(sent.options.body, /ar-EG-SalmaNeural/);

  res = await call('POST', { text: 'a', voice: 'en-GB-SoniaNeural', language: 'en-GB', phoneme: 'æ' }, 'test-phoneme');
  assert.equal(res.code, 200);
  assert.match(sent.options.body, /<phoneme alphabet="ipa" ph="æ">a<\/phoneme>/);

  const before = sent.url;
  res = await call('POST', { text: 'أهلاً عبودي', voice: 'ar-EG-SalmaNeural', language: 'ar-EG' }, 'test-private');
  assert.equal(res.code, 400);
  assert.equal(res.body.code, 'PERSONAL_TEXT_BLOCKED');
  assert.equal(sent.url, before);

  res = await call('POST', { text: 'Locale mismatch', voice: 'ar-EG-SalmaNeural', language: 'en-GB' }, 'test-mismatch');
  assert.equal(res.code, 400);
  res = await call('POST', { text: 'Unknown voice', voice: 'not-a-voice', language: 'en-GB' }, 'test-voice');
  assert.equal(res.code, 400);

  delete process.env.AZURE_SPEECH_KEY;
  res = await call('POST', { text: 'No key', voice: 'en-GB-SoniaNeural', language: 'en-GB' }, 'test-no-key');
  assert.equal(res.code, 503);
  process.env.AZURE_SPEECH_KEY = 'test-azure-key';

  globalThis.fetch = async () => ({ ok: false, status: 429, headers: { get(name) { return name === 'retry-after' ? '20' : null; } } });
  res = await call('POST', { text: 'Provider limit test', voice: 'en-GB-SoniaNeural', language: 'en-GB' }, 'test-provider-limit');
  assert.equal(res.code, 429);
  assert.equal(res.headers['retry-after'], '20');

  globalThis.fetch = async () => ({ ok: false, status: 401, headers: { get() { return null; } } });
  res = await call('POST', { text: 'Authentication test', voice: 'en-GB-SoniaNeural', language: 'en-GB' }, 'test-auth');
  assert.equal(res.code, 502);
  assert.equal(res.body.code, 'PROVIDER_AUTH_FAILED');

  console.log('Azure TTS API tests passed: method handling, English, Arabic, IPA phonemes, MP3 response, privacy guard, validation, missing credentials, 429 retry-after, and authentication errors.');
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.AZURE_SPEECH_KEY;
  else process.env.AZURE_SPEECH_KEY = oldKey;
  if (oldRegion === undefined) delete process.env.AZURE_SPEECH_REGION;
  else process.env.AZURE_SPEECH_REGION = oldRegion;
}
