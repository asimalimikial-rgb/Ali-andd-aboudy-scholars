const MODEL = 'gemini-3.8-flash-lite-tts';
const VOICES = new Set([
  'Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe',
  'Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi',
  'Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird',
  'Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'
]);
const RATE_BUCKETS = new Map();
function allowedRequest(ip) {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(ip) || { start: now, count: 0 };
  if (now - bucket.start > 60000) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  RATE_BUCKETS.set(ip, bucket);
  return bucket.count <= 40;
}
function pcmToWav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8); header.write('fmt ', 12); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
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
  const voice = typeof body.voice === 'string' ? body.voice : 'Puck';
  const language = body.language === 'ar-XA' ? 'ar-XA' : 'en-GB';
  if (!text || text.length > 600 || !VOICES.has(voice)) {
    return res.status(400).json({ error: 'Invalid text or voice selection' });
  }
  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
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
    const part = data.candidates?.[0]?.content?.parts?.find(item => item.inlineData?.data);
    if (!part?.inlineData?.data) return res.status(502).json({ error: 'Gemini returned no audio data' });
    const pcm = Buffer.from(part.inlineData.data, 'base64');
    if (!pcm.length) return res.status(502).json({ error: 'Gemini returned empty audio data' });
    const wav = pcmToWav(pcm);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(wav.length));
    return res.status(200).send(wav);
  } catch (error) {
    return res.status(502).json({ error: 'Gemini speech synthesis failed' });
  }
};
