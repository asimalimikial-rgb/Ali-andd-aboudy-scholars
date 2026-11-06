const VOICES = new Map([
  ['en-GB-SoniaNeural', 'en-GB'],
  ['en-GB-RyanNeural', 'en-GB'],
  ['ar-EG-SalmaNeural', 'ar-EG'],
  ['ar-EG-ShakirNeural', 'ar-EG'],
  ['ar-SA-ZariyahNeural', 'ar-SA'],
  ['ar-SA-HamedNeural', 'ar-SA']
]);
const PERSONAL_TEXT = /\b(?:ali|aboudy|aboudi)\b|علي|عبودي|عبودى/i;
const RATE_BUCKETS = new Map();
let providerWindow = { start: 0, count: 0 };

function allowRequest(ip) {
  const now = Date.now();
  let bucket = RATE_BUCKETS.get(ip);
  if (!bucket || now - bucket.start >= 60000) bucket = { start: now, count: 0 };
  bucket.count += 1;
  RATE_BUCKETS.set(ip, bucket);
  if (RATE_BUCKETS.size > 5000) {
    for (const [key, value] of RATE_BUCKETS) if (now - value.start >= 120000) RATE_BUCKETS.delete(key);
  }
  if (bucket.count > 9) return false;

  // Keep this Vercel instance below FreeTTS' published 20 requests/minute/IP cap.
  if (now - providerWindow.start >= 60000) providerWindow = { start: now, count: 0 };
  providerWindow.count += 1;
  return providerWindow.count <= 9;
}

function rateString(rate) {
  const offset = Math.round((rate - 1) * 100);
  return (offset >= 0 ? '+' : '') + offset + '%';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voice = typeof body.voice === 'string' ? body.voice : 'en-GB-SoniaNeural';
  const voiceLanguage = VOICES.get(voice);
  const language = typeof body.language === 'string' ? body.language : voiceLanguage;
  const rate = Number(body.rate || 0.95);
  const safePhonemeSsml = /^<speak><phoneme alphabet="ipa" ph="[^"<>]{1,32}">[^<>]{1,80}<\/phoneme><\/speak>$/u.test(text);
  const containsMarkup = /[<>]/.test(text);

  if (!text || text.length > 1000 || !voiceLanguage || language !== voiceLanguage ||
      !Number.isFinite(rate) || rate < 0.75 || rate > 1.25 ||
      (containsMarkup && !safePhonemeSsml)) {
    return res.status(400).json({ error: 'Invalid text, voice, language, rate, or SSML', code: 'INVALID_TTS_REQUEST' });
  }
  if (PERSONAL_TEXT.test(text)) {
    return res.status(400).json({ error: 'Personal names are kept on this device and cannot be sent to online speech.', code: 'PERSONAL_TEXT_BLOCKED' });
  }
  if (!allowRequest(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Speech request limit reached. Please wait one minute.', code: 'APP_RATE_LIMITED' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch('https://freetts.org/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate: rateString(rate), pitch: '+0Hz' }),
      signal: controller.signal
    });

    if (!upstream.ok) {
      const status = upstream.status;
      const retryAfter = upstream.headers?.get?.('retry-after');
      if (status === 429) res.setHeader('Retry-After', retryAfter || '60');
      return res.status(status === 429 ? 429 : 502).json({
        error: 'Free neural speech provider unavailable',
        code: status === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_ERROR',
        providerStatus: status
      });
    }

    const generated = await upstream.json();
    const fileId = generated && typeof generated.file_id === 'string' ? generated.file_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return res.status(502).json({ error: 'Speech provider returned an invalid audio reference', code: 'INVALID_AUDIO_REFERENCE' });
    }

    const audioResponse = await fetch('https://freetts.org/api/audio/' + fileId, { signal: controller.signal });
    if (!audioResponse.ok) {
      const status = audioResponse.status;
      const retryAfter = audioResponse.headers?.get?.('retry-after');
      if (status === 429) res.setHeader('Retry-After', retryAfter || '60');
      return res.status(status === 429 ? 429 : 502).json({
        error: 'Generated audio could not be downloaded',
        code: status === 429 ? 'PROVIDER_RATE_LIMITED' : 'AUDIO_DOWNLOAD_FAILED',
        providerStatus: status
      });
    }

    const contentType = String(audioResponse.headers?.get?.('content-type') || 'audio/mpeg');
    if (!contentType.includes('audio')) {
      return res.status(502).json({ error: 'Speech provider returned a non-audio response', code: 'INVALID_AUDIO_RESPONSE' });
    }
    const audio = Buffer.from(await audioResponse.arrayBuffer());
    if (!audio.length) return res.status(502).json({ error: 'Speech provider returned empty audio', code: 'EMPTY_AUDIO_RESPONSE' });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    return res.status(200).send(audio);
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    console.error('Free neural speech request failed:', timedOut ? 'timeout' : (error?.message || 'unknown error'));
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Speech request timed out' : 'Free neural speech synthesis failed',
      code: timedOut ? 'TTS_TIMEOUT' : 'TTS_UPSTREAM_FAILURE'
    });
  } finally {
    clearTimeout(timeout);
  }
};
