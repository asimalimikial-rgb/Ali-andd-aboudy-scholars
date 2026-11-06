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
  ['IPA request',html.includes('phoneme:item[0]') && html.includes('synthesisText') && html.includes('<phoneme alphabet="ipa" ph="')],
  ['FreeTTS API configuration',api.includes('https://freetts.org/api/tts') && api.includes('https://freetts.org/api/audio/') && api.includes('audio/mpeg') && api.includes('safePhonemeSsml')],
  ['Offline IPA cache key',html.includes('ipa:'+String.fromCharCode(39)+'+phoneme') && html.includes('rate,phoneme),blob')],
  ['Mobile trace canvas size',html.includes('height:210px')],
  ['Wide single-column Word Study grid',html.includes('jolly-wordstudy-grid') && html.includes('grid-template-columns:minmax(0,1fr)')],
  ['FreeTTS language routing',html.includes("language:segment.isArabic?'ar-EG':'en-GB'")],
  ['Local speech is default and Neural is optional',html.includes("speechEngine: 'local'") && html.includes("!['local','neural'].includes(Store.data.settings.speechEngine)") && html.includes('Speech.localSpeak = Speech.speak.bind(Speech)')],
  ['Android NativeSpeech bridge is initialized',html.includes('Speech.init();') && html.includes('window.NativeSpeech.speak') && html.includes('voice-picker-select') && html.includes('voice-picker-ar-select')],
  ['Parent can select local or experimental neural engine',html.includes('id="speech-engine-mode"') && html.includes('value="local"') && html.includes('value="neural"')],
  ['All 42 sound entries mapped',true]
];
const soundBlock=html.slice(html.indexOf('const JOLLY_SOUND_GROUPS'),html.indexOf('const JOLLY_TRICKY'));
const soundEntries=[...soundBlock.matchAll(/\['([^']+)','([^']+)'/g)].map(m=>m[1].toLowerCase()+'|'+m[2].toLowerCase());
const phonemeBlock=html.slice(html.indexOf('getJollyPhonemeData(sound, example)'),html.indexOf('  init() {',html.indexOf('getJollyPhonemeData(sound, example)')));
const phonemeKeys=new Set([...phonemeBlock.matchAll(/'([^']+\|[^']+)':\['/g)].map(m=>m[1]));
checks[checks.length-1][1]=soundEntries.length===42 && soundEntries.every(k=>phonemeKeys.has(k));
const blending=html.indexOf("else if(skill==='blending')");
const study=html.indexOf("else if(skill==='wordstudy')");
const segmenting=html.indexOf("else if(skill==='segmenting')");
checks.push(['Learning sections remain reachable',blending>=0 && study>blending && segmenting>study]);
const narrationStart=html.indexOf('const narrateQuestion = async () =>');
const narrationEnd=html.indexOf('this.renderQuestionType(q, area);',narrationStart);
const narration=narrationStart>=0?html.slice(narrationStart,narrationEnd):'';
checks.push(['Arabic helper is rendered before answer choices',html.includes('مساعدة قبل الإجابة: ') && html.includes('const arabicHelper = Store.data.settings.arabicSupport !== false ? this.getArabicHelper(q) :')]);
checks.push(['Arabic helper is spoken before answer selection',narration.includes('if (arabicHelper) await HybridSpeech.speak(arabicHelper, { language: \'ar\' })')]);
checks.push(['Ali target letters use phoneme playback',html.includes('playAliLetterSound(letter)') && html.includes("a:'æ'") && html.includes('this.playAliLetterSound(targetLetter)')]);
checks.push(['Slash-delimited phonemes are spoken as phonics sounds',html.includes('titleText.matchAll(') && html.includes('await this.playAliLetterSound(token[1])')]);
checks.push(['Single-letter phonics options use sound playback',html.includes('this.playAliLetterSound(optionText)')]);
const hybridStart=html.indexOf('async function speak(input,opts)');
const hybridEnd=html.indexOf('async function stats()',hybridStart);
const hybrid=hybridStart>=0?html.slice(hybridStart,hybridEnd):'';
checks.push(['Cached audio is reused before new network generation',hybrid.indexOf('if(cached&&cached.blob&&!opts.forceLocal&&!opts.forceOnline)')>=0 && hybrid.indexOf('if(cached&&cached.blob&&!opts.forceLocal&&!opts.forceOnline)')<hybrid.indexOf('blob=await fetchClip(')]);
checks.push(['Force-online diagnostics bypass cache',hybrid.includes('!opts.forceOnline') && hybrid.includes('!opts.forceLocal&&!opts.forceOnline')]);
checks.push(['Local engine dispatches to Android NativeSpeech by default',hybrid.includes("(Store.data.settings.speechEngine || 'local') !== 'neural'") && hybrid.includes('Speech.localSpeak(localText') && html.includes('window.NativeSpeech.speak(nativeId')]);
checks.push(['No Arabic explanation is repeated after answer',!html.includes('const arabicExplanation = Store.data.settings.arabicSupport') && !html.includes('arabicExplanation ? HybridSpeech.speak(arabicExplanation)') && html.includes('HybridSpeech.speak(spokenFeedback)')]);
const answerStart=html.indexOf('  evaluateAnswer(q) {');
const answerEnd=html.indexOf('  advanceActivity() {',answerStart);
const answerHandler=answerStart>=0&&answerEnd>answerStart?html.slice(answerStart,answerEnd):'';
checks.push(['Post-answer feedback contains no hints or explanations',answerHandler.length>0&&!answerHandler.includes('q.explanation')&&!answerHandler.includes('q.hint')&&!answerHandler.includes('explanation')]);
checks.push(['Correct and incorrect answers use encouragement only',answerHandler.includes('أحسنت! إجابة صحيحة!')&&answerHandler.includes('محاولة جميلة!')&&answerHandler.includes("'Great job! أحسنت!'")&&answerHandler.includes("'Good try! محاولة جميلة!'")]);

for(const [name,ok] of checks){if(!ok)throw new Error('Failed: '+name);console.log('PASS '+name);}
