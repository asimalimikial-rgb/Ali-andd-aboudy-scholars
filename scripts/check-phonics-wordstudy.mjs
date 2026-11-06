import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const api=fs.readFileSync('api/tts.js','utf8');
const checks=[
  ['Word Study tab',html.includes("['wordstudy','📚 Word Study','دراسة الكلمات']")],
  ['Arabic word meanings',html.includes('JOLLY_ARABIC_WORDS')],
  ['Finger tracing canvas',html.includes('openTracePad(container, target)') && html.includes("createElement('canvas')") && html.includes("pointermove")],
  ['Letter-name control',html.includes('Letter name / اسم الحرف')],
  ['Phonics-sound control',html.includes('Phonics sound / صوت الحرف')],
  ['Example-word control',html.includes('Example word / كلمة المثال')],
  ['IPA request',html.includes('phoneme:phoneme||undefined') && html.includes('en-GB-Standard-A')],
  ['IPA server validation',api.includes('const PHONEMES = new Set(') && api.includes('alphabet="ipa"')],
  ['Offline IPA cache key',html.includes('ipa:'+String.fromCharCode(39)+'+phoneme') && html.includes('rate,phoneme),blob')]
];
for(const [name,ok] of checks){if(!ok)throw new Error('Failed: '+name);console.log('PASS '+name);}
