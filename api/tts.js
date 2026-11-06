const VOICES = new Set([
  'en-GB-Chirp3-HD-Aoede','en-GB-Chirp3-HD-Achird','en-GB-Chirp3-HD-Kore',
  'en-GB-Chirp3-HD-Charon','en-GB-Chirp3-HD-Zephyr','en-GB-Chirp3-HD-Fenrir','en-GB-Standard-A',
  'ar-XA-Chirp3-HD-Aoede','ar-XA-Chirp3-HD-Achird','ar-XA-Chirp3-HD-Kore',
  'ar-XA-Chirp3-HD-Charon','ar-XA-Chirp3-HD-Zephyr','ar-XA-Chirp3-HD-Fenrir'
]); 
const PHONEMES = new Set(['s','æ','t','ɪ','p','n','k','ɛ','h','ɹ','m','d','ɡ','ɒ','ʌ','l','f','b','eɪ','dʒ','əʊ','aɪ','iː','ɔː','z','w','ŋ','v','uː','ʊ','j','ks','tʃ','ʃ','ð','θ','kw','aʊ','ɔɪ','ɜː','ɑː']);
const RATE_BUCKETS = new Map();
function allowedRequest(ip) {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(ip) || { start: now, count: 0 };
  if (now - bucket.start > 60000) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  RATE_BUCKETS.set(ip, bucket);
  return bucket.count <= 45;
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
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Speech service is not configured yet' });
  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voice = typeof body.voice === 'string' ? body.voice : '';
  const phoneme = typeof body.phoneme === 'string' ? body.phoneme : '';
  const isPhoneme = !!phoneme && PHONEMES.has(phoneme);
  if (!text || text.length > 500 || (phoneme && !isPhoneme) || !(VOICES.has(voice) || (isPhoneme && voice === 'en-GB-Standard-A')) || (isPhoneme && !/^[A-Za-z /-]{1,12}$/.test(text))) {
    return res.status(400).json({ error: 'Invalid text, voice, or phoneme selection' });
  }
  const languageCode = voice.startsWith('ar-XA-') ? 'ar-XA' : 'en-GB';
  const safePhonemeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  const rate = Number(body.rate);
  const speakingRate = Number.isFinite(rate) ? Math.max(0.75, Math.min(1.25, rate)) : 0.95;
  try {
    const upstream = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: isPhoneme ? { ssml: '<speak><phoneme alphabet="ipa" ph="' + phoneme + '">' + safePhonemeText + '</phoneme></speak>' } : { text },
        voice: { languageCode, name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate }
      })
    });
    if (!upstream.ok) {
      const status = upstream.status;
      return res.status(status === 429 ? 429 : 502).json({ error: 'Speech provider unavailable', providerStatus: status });
    }
    const data = await upstream.json();
    if (!data.audioContent) return res.status(502).json({ error: 'Speech provider returned no audio' });
    const audio = Buffer.from(data.audioContent, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    return res.status(200).send(audio);
  } catch (error) {
    return res.status(502).json({ error: 'Speech synthesis failed' });
  }
};
