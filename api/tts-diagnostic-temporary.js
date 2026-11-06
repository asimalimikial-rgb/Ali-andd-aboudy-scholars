module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ configured: false, error: 'GEMINI_API_KEY is not available to this Preview deployment' });

  const model = 'gemini-3.8-flash-lite-tts';
  const tests = [
    { language: 'en-GB', voice: 'Puck', text: 'Hello. This is a short voice test.' },
    { language: 'ar-XA', voice: 'Kore', text: 'مرحباً، هذا اختبار صوتي قصير.' }
  ];

  const results = [];
  for (const test of tests) {
    try {
      const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: test.text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              languageCode: test.language,
              voiceConfig: { prebuiltVoiceConfig: { voiceName: test.voice } }
            }
          }
        })
      });

      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok) {
        let detail = {};
        try { detail = await upstream.json(); } catch (_) {}
        results.push({
          language: test.language,
          httpStatus: upstream.status,
          ok: false,
          providerErrorCode: detail.error?.status || null,
          providerErrorMessage: String(detail.error?.message || 'Provider returned an error').slice(0, 240)
        });
        continue;
      }

      const data = await upstream.json();
      const inlineData = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
      if (!inlineData?.data) {
        results.push({
          language: test.language,
          httpStatus: upstream.status,
          ok: false,
          error: 'Provider returned no inline audio data',
          finishReason: data.candidates?.[0]?.finishReason || null
        });
        continue;
      }
      const audio = Buffer.from(inlineData.data, 'base64');
      results.push({
        language: test.language,
        httpStatus: upstream.status,
        ok: true,
        audioMimeType: inlineData.mimeType || contentType || 'unknown',
        audioBytes: audio.length,
        wavHeader: audio.length >= 12 && audio.subarray(0, 4).toString('ascii') === 'RIFF' && audio.subarray(8, 12).toString('ascii') === 'WAVE'
      });
    } catch (error) {
      results.push({
        language: test.language,
        ok: false,
        error: String(error?.message || 'Network error').slice(0, 200)
      });
    }
  }

  return res.status(200).json({ configured: true, model, tests: results });
};
