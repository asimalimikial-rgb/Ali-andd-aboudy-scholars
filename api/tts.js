const VOICES = new Map([
  ['en-GB-SoniaNeural', 'en-GB'],
  ['en-GB-RyanNeural', 'en-GB'],
  ['ar-EG-SalmaNeural', 'ar-EG'],
  ['ar-EG-ShakirNeural', 'ar-EG'],
  ['ar-SA-ZariyahNeural', 'ar-SA'],
  ['ar-SA-HamedNeural', 'ar-SA']
]);
const PHONEMES = new Set(['s','æ','t','ɪ','p','n','k','ɛ','h','ɹ','m','d','ɡ','ɒ','ʌ','l','f','b','eɪ','dʒ','əʊ','aɪ','iː','ɔː','z','w','ŋ','v','uː','ʊ','j','ks','tʃ','ʃ','ð','θ','kw','aʊ','ɔɪ','ɜː','ɑː']);
const PERSONAL_TEXT = /\b(?:ali|aboudy|aboudi)\b|علي|عبودي|عبودى/i;
const RATE_BUCKETS = new Map();

function allowedRequest(ip) {
  const now = Date.now();
  let bucket = RATE_BUCKETS.get(ip);
  if (!bucket || now - bucket.start >= 60000) bucket = { start: now, count: 0 };
  bucket.count += 1;
  RATE_BUCKETS.set(ip, bucket);
  if (RATE_BUCKETS.size > 5000) {
    for (const [key, value] of RATE_BUCKETS) if (now - value.start >= 120000) RATE_BUCKETS.delete(key);
  }
  return bucket.count <= 18;
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, character => ({
    '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'
  })[character]);
}

function buildSsml(text, voice, language, rate, phoneme) {
  const content = phoneme
    ? '<phoneme alphabet="ipa" ph="' + escapeXml(phoneme) + '">' + escapeXml(text) + '</phoneme>'
    : escapeXml(text);
  const percent = Math.round(rate * 100);
  return '<speak version="1.0" xml:lang="' + language + '"><voice name="' + voice +
    '"><prosody rate="' + percent + '%">' + content + '</prosody></voice></speak>';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (!allowedRequest(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Application speech request limit reached', code: 'APP_RATE_LIMITED' });
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = String(process.env.AZURE_SPEECH_REGION || '').trim().toLowerCase();
  if (!key || !/^[a-z0-9]+$/.test(region)) {
    return res.status(503).json({ error: 'Azure Speech is not configured', code: 'TTS_NOT_CONFIGURED' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voice = typeof body.voice === 'string' ? body.voice : 'en-GB-SoniaNeural';
  const voiceLanguage = VOICES.get(voice);
  const language = typeof body.language === 'string' ? body.language : voiceLanguage;
  const phoneme = typeof body.phoneme === 'string' ? body.phoneme : '';
  const rate = Number(body.rate || 0.95);

  if (!text || text.length > 600 || !voiceLanguage || language !== voiceLanguage ||
      !Number.isFinite(rate) || rate < 0.75 || rate > 1.25 ||
      (phoneme && (!PHONEMES.has(phoneme) || language !== 'en-GB'))) {
    return res.status(400).json({ error: 'Invalid text, voice, language, rate, or phoneme', code: 'INVALID_TTS_REQUEST' });
  }
  if (PERSONAL_TEXT.test(text)) {
    return res.status(400).json({ error: 'Personal names are kept on this device and cannot be sent to online speech.', code: 'PERSONAL_TEXT_BLOCKED' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const endpoint = 'https://' + region + '.tts.speech.microsoft.com/cognitiveservices/v1';
    const ssml = buildSsml(text, voice, language, rate, phoneme);
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'AliAboudyScholars/1.3.0'
      },
      body: ssml,
      signal: controller.signal
    });

    if (!upstream.ok) {
      const status = upstream.status;
      const retryAfter = upstream.headers?.get?.('retry-after');
      if (status === 429) res.setHeader('Retry-After', retryAfter || '15');
      return res.status(status === 429 ? 429 : 502).json({
        error: 'Azure Speech provider unavailable',
        code: status === 429 ? 'PROVIDER_RATE_LIMITED' :
          (status === 401 || status === 403 ? 'PROVIDER_AUTH_FAILED' :
          (status === 400 ? 'PROVIDER_REQUEST_REJECTED' : 'PROVIDER_ERROR')),
        providerStatus: status
      });
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    if (!audio.length) return res.status(502).json({ error: 'Azure returned empty audio', code: 'EMPTY_AUDIO_RESPONSE' });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    return res.status(200).send(audio);
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    console.error('Azure Speech request failed:', timedOut ? 'timeout' : (error?.message || 'unknown error'));
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Speech request timed out' : 'Azure Speech synthesis failed',
      code: timedOut ? 'TTS_TIMEOUT' : 'TTS_UPSTREAM_FAILURE'
    });
  } finally {
    clearTimeout(timeout);
  }
};
