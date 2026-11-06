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
  ['IPA request',html.includes('phoneme:phoneme||undefined') && html.includes('en-GB-SoniaNeural')],
  ['FreeTTS API configuration',api.includes('https://freetts.org/api/tts') && api.includes('https://freetts.org/api/audio/') && api.includes('audio/mpeg') && api.includes('PHONEME_UNSUPPORTED')],
  ['Offline IPA cache key',html.includes('ipa:'+String.fromCharCode(39)+'+phoneme') && html.includes('rate,phoneme),blob')],
  ['Mobile trace canvas size',html.includes('height:210px')],
  ['Wide single-column Word Study grid',html.includes('jolly-wordstudy-grid') && html.includes('grid-template-columns:minmax(0,1fr)')],
  ['FreeTTS language routing',html.includes("language:segment.isArabic?'ar-EG':'en-GB'")],
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
const narrationStart=html.indexOf('const narrateQuestion = async () =>');
const narrationEnd=html.indexOf('this.renderQuestionType(q, area);',narrationStart);
const narration=narrationStart>=0?html.slice(narrationStart,narrationEnd):'';
checks.push(['English question only before answer',narration.includes('await HybridSpeech.speak(titleText)') && !narration.includes('helperText') && !narration.includes('getArabicHelper')]);
checks.push(['Ali target letters use phoneme playback',html.includes('playAliLetterSound(letter)') && html.includes("a:'æ'") && html.includes('this.playAliLetterSound(targetLetter)')]);
checks.push(['Slash-delimited phonemes are spoken as phonics sounds',html.includes('titleText.matchAll(') && html.includes('await this.playAliLetterSound(token[1])')]);
checks.push(['Single-letter phonics options use sound playback',html.includes('this.playAliLetterSound(optionText)')]);
const hybridStart=html.indexOf('async function speak(input,opts)');
const hybridEnd=html.indexOf('async function stats()',hybridStart);
const hybrid=hybridStart>=0?html.slice(hybridStart,hybridEnd):'';
checks.push(['Online neural audio is attempted before cached playback',hybrid.indexOf('blob=await fetchClip(')>=0 && hybrid.indexOf('blob=await fetchClip(')<hybrid.indexOf('if(!blob&&cached&&cached.blob&&!opts.forceLocal&&!opts.forceOnline)')]);
checks.push(['Force-online diagnostics bypass cache',hybrid.includes('!opts.forceOnline') && hybrid.includes('!opts.forceLocal&&!opts.forceOnline')]);
checks.push(['Local TTS is the final fallback',hybrid.indexOf('await playBlob(blob,rate,token)')>=0 && hybrid.indexOf('await localSpeak(')>hybrid.indexOf('await playBlob(blob,rate,token)')]);
checks.push(['One Arabic explanation appears after answer only',html.includes("arabicBlock.className = 'arabic-explanation'") && html.includes('HybridSpeech.speak(spokenFeedback)') && html.includes('arabicExplanation ? HybridSpeech.speak(arabicExplanation)') && !html.includes("arabic.textContent = 'شرح مساعد: ' + this.getArabicHelper(q)")]);

for(const [name,ok] of checks){if(!ok)throw new Error('Failed: '+name);console.log('PASS '+name);}
