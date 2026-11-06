const ttsHandler = require('./tts.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ configured: false, error: 'GEMINI_API_KEY is not available to this Preview deployment' });
  }

  const tests = [
    { language: 'en-GB', voice: 'Puck', text: 'Hello. This is a short voice test.' },
    { language: 'ar-XA', voice: 'Kore', text: 'مرحباً، هذا اختبار صوتي قصير.' }
  ];
  const results = [];

  for (const test of tests) {
    const captured = {
      code: 200,
      headers: {},
      body: null,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
      status(code) { this.code = code; return this; },
      json(value) { this.body = value; return this; },
      send(value) { this.body = value; return this; },
      end() { return this; }
    };

    try {
      await ttsHandler({
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
        body: { text: test.text, voice: test.voice, language: test.language }
      }, captured);

      const isBuffer = Buffer.isBuffer(captured.body);
      const audio = isBuffer ? captured.body : null;
      results.push({
        language: test.language,
        httpStatus: captured.code,
        ok: captured.code === 200 && !!audio,
        contentType: captured.headers['content-type'] || null,
        audioBytes: audio ? audio.length : 0,
        wavHeaderValid: audio ? (
          audio.length >= 12 &&
          audio.subarray(0, 4).toString('ascii') === 'RIFF' &&
          audio.subarray(8, 12).toString('ascii') === 'WAVE'
        ) : false,
        error: !audio && captured.body ? String(captured.body.error || 'Request failed').slice(0, 200) : null,
        providerStatus: !audio && captured.body ? captured.body.providerStatus || null : null
      });
    } catch (error) {
      results.push({
        language: test.language,
        ok: false,
        error: String(error?.message || 'Handler test failed').slice(0, 200)
      });
    }
  }

  return res.status(200).json({ configured: true, testedHandler: 'api/tts.js', tests: results });
};
