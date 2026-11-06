const MODEL = 'gemini-3.8-flash-lite-tts';
const VOICES = new Set([
  'Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe',
  'Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi',
  'Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird',
  'Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'
]);
const PHONEMES = new Set(['s','æ','t','ɪ','p','n','k','ɛ','h','ɹ','m','d','ɡ','ɒ','ʌ','l','f','b','eɪ','dʒ','əʊ','aɪ','iː','ɔː','z','w','ŋ','v','uː','ʊ','j','ks','tʃ','ʃ','ð','θ','kw','aʊ','ɔɪ','ɜː','ɑː']);
const RATE_BUCKETS = new Map();

function allowedRequest(ip) {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(ip) || { start: now, count: 0 };
  if (now - bucket.start > 60000) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  RATE_BUCKETS.set(ip, bucket);
  return bucket.count <= 40;
}

function resolveVoice(input) {
  const raw = String(input || 'Puck');
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

  const hasWavHeader =
    audio.length >= 12 &&
    audio.subarray(0, 4).toString('ascii') === 'RIFF' &&
    audio.subarray(8, 12).toString('ascii') === 'WAVE';
  if (hasWavHeader) return audio;

  const mimeType = String(inlineData.mimeType || '').toLowerCase();
  if (!mimeType.startsWith('audio/l16')) {
    throw new Error('Unsupported Gemini audio format: ' + (mimeType || 'unknown'));
  }

  const rate = Number((mimeType.match(/rate=(\d+)/) || [])[1]) || 24000;
  const channels = Number((mimeType.match(/channels=(\d+)/) || [])[1]) || 1;
  const bitsPerSample = Number((mimeType.match(/^audio\/l(\d+)/) || [])[1]) || 16;
  if (bitsPerSample !== 16 || channels < 1 || channels > 2 || rate < 8000 || rate > 96000 || audio.length % 2 !== 0) {
    throw new Error('Unsupported Gemini PCM parameters');
  }

  // audio/L16 is signed 16-bit big-endian PCM; WAV PCM samples are little-endian.
  const pcm = Buffer.from(audio);
  for (let i = 0; i < pcm.length; i += 2) {
    const first = pcm[i];
    pcm[i] = pcm[i + 1];
    pcm[i + 1] = first;
  }
  return pcmToWav(pcm, rate, channels, bitsPerSample);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (!allowedRequest(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini TTS is not configured yet' });

  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voiceInput = typeof body.voice === 'string' ? body.voice : 'Aoede';
  const voice = resolveVoice(voiceInput);
  const language = body.language === 'ar-XA' || voiceInput.startsWith('ar-XA-') ? 'ar-XA' : 'en-GB';
  const phoneme = typeof body.phoneme === 'string' ? body.phoneme : '';
  const isPhoneme = !!phoneme && PHONEMES.has(phoneme);
  if (!text || text.length > 600 || !voice || (phoneme && !isPhoneme) || (isPhoneme && language !== 'en-GB')) {
    return res.status(400).json({ error: 'Invalid text, voice, language, or phoneme selection' });
  }

  try {
    const part = { text };
    if (isPhoneme) {
      part.speechMetadata = { style: 'Produce only the isolated English phoneme /' + phoneme + '/. Do not say the letter name, an example word, or an explanation. Keep the sound brief and clear for a young child.' };
    }
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
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
      })
    });

    if (!upstream.ok) {
      const status = upstream.status;
      return res.status(status === 429 ? 429 : (status === 400 ? 400 : 502))
        .json({ error: 'Gemini speech provider unavailable', providerStatus: status });
    }

    const data = await upstream.json();
    const inlineData = data.candidates?.[0]?.content?.parts?.find(item => item.inlineData?.data)?.inlineData;
    if (!inlineData?.data) return res.status(502).json({ error: 'Gemini returned no audio data' });

    const wav = normalizeGeminiAudio(inlineData);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(wav.length));
    return res.status(200).send(wav);
  } catch (error) {
    console.error('Gemini TTS synthesis failed:', error?.message || 'Unknown error');
    return res.status(502).json({ error: 'Gemini speech synthesis failed' });
  }
};
