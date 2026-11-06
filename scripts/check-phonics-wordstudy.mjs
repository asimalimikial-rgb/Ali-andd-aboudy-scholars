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
  ['Gemini TTS configuration',api.includes('process.env.GEMINI_API_KEY') && api.includes('gemini-3.8-flash-lite-tts') && api.includes('speechMetadata') && api.includes('const PHONEMES = new Set(')],
  ['Offline IPA cache key',html.includes('ipa:'+String.fromCharCode(39)+'+phoneme') && html.includes('rate,phoneme),blob')],
  ['Mobile trace canvas size',html.includes('height:210px')],
  ['Wide single-column Word Study grid',html.includes('jolly-wordstudy-grid') && html.includes('grid-template-columns:minmax(0,1fr)')],
  ['TTS language routing',html.includes("language:segment.isArabic?'ar-XA':'en-GB'")],
  ['Android offline TTS bridge',html.includes('window.NativeSpeech.speak(nativeId') && html.includes('window.__nativeSpeechReady') && !html.includes('tts-bridge.js')],
  ['All 42 sound entries mapped',true]
];
const soundBlock=html.slice(html.indexOf('const JOLLY_SOUND_GROUPS'),html.indexOf('const JOLLY_TRICKY'));
const soundEntries=[...soundBlock.matchAll(/\['([^']+)','([^']+)'/g)].map(m=>m[1].toLowerCase()+'|'+m[2].toLowerCase());
const phonemeBlock=html.slice(html.indexOf('playJollyPhoneme(sound, example)'),html.indexOf('  init() {',html.indexOf('playJollyPhoneme(sound, example)')));
const phonemeKeys=new Set([...phonemeBlock.matchAll(/'([^']+\|[^']+)':\['/g)].map(m=>m[1]));
checks[checks.length-1][1]=soundEntries.length===42 && soundEntries.every(k=>phonemeKeys.has(k));
const blending=html.indexOf("else if(skill==='blending')");
const study=html.indexOf("else if(skill==='wordstudy')");
const segmenting=html.indexOf("else if(skill==='segmenting')");
checks.push(['Learning sections remain reachable',blending>=0 && study>blending && segmenting>study]);
for(const [name,ok] of checks){if(!ok)throw new Error('Failed: '+name);console.log('PASS '+name);}
