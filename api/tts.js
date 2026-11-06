const MODEL = 'gemini-3.8-flash-lite-tts';
const VOICES = new Set([
  'Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe',
  'Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi',
  'Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird',
  'Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'
]);
const PHONEMES = new Set(['s','æ','t','ɪ','p','n','k','ɛ','h','ɹ','m','d','ɡ','ɒ','ʌ','l','f','b','eɪ','dʒ','əʊ','aɪ','iː','ɔː','z','w','ŋ','v','uː','ʊ','j','ks','tʃ','ʃ','ð','θ','kw','aʊ','ɔɪ','ɜː','ɑː']);
const PERSONAL_TEXT = /\b(?:ali|aboudy|aboudi)\b|علي|عبودي|عبودى/i;
const RATE_BUCKETS = new Map();

function allowedRequest(ip) {
  const now = Date.now();
  let bucket = RATE_BUCKETS.get(ip);
  if (!bucket || now - bucket.start > 60000) bucket = { start: now, count: 0 };
  bucket.count += 1;
  RATE_BUCKETS.set(ip, bucket);
  if (RATE_BUCKETS.size > 5000) {
    for (const [key, value] of RATE_BUCKETS) {
      if (now - value.start > 120000) RATE_BUCKETS.delete(key);
    }
  }
  return bucket.count <= 40;
}

function resolveVoice(input) {
  const raw = String(input || 'Aoede');
  if (raw === 'en-GB-Standard-A') return 'Aoede';
  const match = raw.match(/(?:^|-)(Aoede|Achird|Kore|Charon|Zephyr|Fenrir|Puck|Leda|Orus|Callirrhoe|Autonoe|Enceladus|Iapetus|Umbriel|Algieba|Despina|Erinome|Algenib|Rasalgethi|Laomedeia|Achernar|Alnilam|Schedar|Gacrux|Pulcherrima|Zubenelgenubi|Vindemiatrix|Sadachbia|Sadaltager|Sulafat)$/i);
  const voice = match ? match[1] : raw;
  return VOICES.has(voice) ? voice : '';
}

function pcmToWav(pcm, sampleRate, channels, bitsPerSample) {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function normalizeGeminiAudio(inlineData) {
  const audio = Buffer.from(inlineData.data, 'base64');
  if (!audio.length) throw new Error('Gemini returned empty audio data');
  const hasWavHeader = audio.length >= 12 &&
    audio.subarray(0, 4).toString('ascii') === 'RIFF' &&
    audio.subarray(8, 12).toString('ascii') === 'WAVE';
  if (hasWavHeader) return audio;

  const mimeType = String(inlineData.mimeType || '').toLowerCase();
  if (!mimeType.startsWith('audio/l16') && !mimeType.startsWith('audio/pcm')) {
    throw new Error('Unsupported Gemini audio format');
  }
  const rate = Number((mimeType.match(/rate=(\d+)/) || [])[1]) || 24000;
  const channels = Number((mimeType.match(/channels=(\d+)/) || [])[1]) || 1;
  const bitsPerSample = Number((mimeType.match(/^audio\/(?:l|pcm)(\d+)/) || [])[1]) || 16;
  if (bitsPerSample !== 16 || channels < 1 || channels > 2 || rate < 8000 || rate > 96000 || audio.length % 2 !== 0) {
    throw new Error('Unsupported Gemini PCM parameters');
  }
  const pcm = Buffer.from(audio);
  // audio/L16 is big-endian; audio/pcm is treated as little-endian PCM.
  if (mimeType.startsWith('audio/l16')) {
    for (let i = 0; i < pcm.length; i += 2) {
      const first = pcm[i];
      pcm[i] = pcm[i + 1];
      pcm[i + 1] = first;
    }
  }
  return pcmToWav(pcm, rate, channels, bitsPerSample);
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
    return res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini TTS is not configured', code: 'TTS_NOT_CONFIGURED' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (error) { body = {}; }
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voiceInput = typeof body.voice === 'string' ? body.voice : 'en-GB-Chirp3-HD-Aoede';
  const voice = resolveVoice(voiceInput);
  const inferredLanguage = voiceInput.startsWith('ar-XA-') ? 'ar-XA' : 'en-GB';
  const language = typeof body.language === 'string' ? body.language : inferredLanguage;
  const phoneme = typeof body.phoneme === 'string' ? body.phoneme : '';
  const isPhoneme = !!phoneme && PHONEMES.has(phoneme);

  if (!text || text.length > 600 || !voice || !['ar-XA','en-GB'].includes(language) ||
      language !== inferredLanguage || (phoneme && !isPhoneme) || (isPhoneme && language !== 'en-GB')) {
    return res.status(400).json({ error: 'Invalid text, voice, language, or phoneme selection', code: 'INVALID_TTS_REQUEST' });
  }
  // Enforce the client-side privacy rule at the server boundary as well.
  if (PERSONAL_TEXT.test(text)) {
    return res.status(400).json({ error: 'Personal names are kept on this device and cannot be sent to online speech.', code: 'PERSONAL_TEXT_BLOCKED' });
  }

  try {
    const part = { text };
    if (isPhoneme) {
      part.speechMetadata = {
        style: 'Produce only the isolated English phoneme /' + phoneme +
          '/. Do not say the letter name, an example word, or an explanation. Keep the sound brief and clear for a young child.'
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let upstream;
    try {
      upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [part] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              languageCode: language,
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
            }
          }
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      const status = upstream.status;
      if (status === 429) {
        const retryAfter = upstream.headers?.get?.('retry-after');
        if (retryAfter) res.setHeader('Retry-After', retryAfter);
      }
      return res.status(status === 429 ? 429 : 502).json({
        error: 'Gemini speech provider unavailable',
        code: status === 429 ? 'PROVIDER_RATE_LIMITED' : (status === 401 || status === 403 ? 'PROVIDER_AUTH_FAILED' : 'PROVIDER_ERROR'),
        providerStatus: status
      });
    }

    const data = await upstream.json();
    const inlineData = data.candidates?.[0]?.content?.parts?.find(item => item.inlineData?.data)?.inlineData;
    if (!inlineData?.data) return res.status(502).json({ error: 'Gemini returned no audio data', code: 'EMPTY_AUDIO_RESPONSE' });

    const wav = normalizeGeminiAudio(inlineData);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(wav.length));
    return res.status(200).send(wav);
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    console.error('Gemini TTS request failed:', timedOut ? 'timeout' : (error?.message || 'unknown error'));
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Speech request timed out' : 'Gemini speech synthesis failed',
      code: timedOut ? 'TTS_TIMEOUT' : 'TTS_UPSTREAM_FAILURE'
    });
  }
};
