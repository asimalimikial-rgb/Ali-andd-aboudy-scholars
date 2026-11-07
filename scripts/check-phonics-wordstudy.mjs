import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const native=fs.readFileSync('android/app/src/main/java/com/alialiaboudyscholars/app/NativeSpeech.java','utf8');
const engine=fs.readFileSync('android/app/src/main/java/com/alialiaboudyscholars/app/EmbeddedTtsEngine.java','utf8');
const sherpa=fs.readFileSync('android/app/src/main/java/com/k2fsa/sherpa/onnx/Tts.kt','utf8');
const prep=fs.readFileSync('scripts/prepare-embedded-tts.sh','utf8');
const gradle=fs.readFileSync('android/app/build.gradle','utf8');
const workflow=fs.readFileSync('.github/workflows/build-apk.yml','utf8');
const checks=[
  ['Word Study tab',html.includes("['wordstudy','📚 Word Study','دراسة الكلمات']")],
  ['Arabic word meanings',html.includes('JOLLY_ARABIC_WORDS')],
  ['Finger tracing canvas',html.includes('openTracePad(container, target)') && html.includes("createElement('canvas')") && html.includes('pointermove')],
  ['Letter-name control',html.includes('Letter name / اسم الحرف')],
  ['Phonics-sound control',html.includes('Phonics sound / صوت الحرف')],
  ['Example-word control',html.includes('Example word / كلمة المثال')],
  ['Mobile trace canvas size',html.includes('height:210px')],
  ['Wide single-column Word Study grid',html.includes('jolly-wordstudy-grid') && html.includes('grid-template-columns:minmax(0,1fr)')],
  ['Arabic helper rendered before answer choices',html.includes('مساعدة قبل الإجابة: ') && html.includes('const arabicHelper = Store.data.settings.arabicSupport !== false ? this.getArabicHelper(q) :')],
  ['Arabic helper spoken before answer selection',/if\s*\(arabicHelper\)\s*await\s+speakIf\s*\(\s*arabicHelper\s*,\s*\{\s*language:\s*['"]ar['"]\s*\}\s*\)/.test(html)],
  ['Ali target letters use shared guarded phoneme playback',html.includes('getAliLetterSpeech(letter)') && html.includes("a:'æ'") && html.includes('guard.say(speech.text, speech.options)')],
  ['Slash-delimited phonemes use shared guarded playback',html.includes('titleText.matchAll(') && html.includes('await playLetterIf(token[1])')],
  ['Single-letter phonics options use sound playback',html.includes('this.playAliLetterSound(optionText)')],
  ['All 42 sound entries mapped',true],
  ['No explanation or hint is emitted after submission',true],
  ['Correct and incorrect answers use encouragement only',true],
  ['Android bridge calls embedded engine',native.includes('new EmbeddedTtsEngine(context)') && native.includes('GeneratedAudio') && native.includes('AudioTrack')],
  ['No Android system TTS dependency',!native.includes('android.speech.tts') && !native.includes('TextToSpeech')],
  ['No browser Web Speech API',!html.includes('speechSynthesis') && !html.includes('SpeechSynthesisUtterance')],
  ['No online TTS route or cache downloader',!html.includes('/api/tts') && !html.includes('fetchClip(') && !html.includes('freetts.org') && !html.includes('onlineVoiceEn') && !html.includes('onlineVoiceAr')],
  ['Embedded model uses sherpa-onnx Supertonic',engine.includes('OfflineTts') && engine.includes('OfflineTtsSupertonicModelConfig') && engine.includes('tts.generateWithConfig')],
  ['Runtime loads the sherpa JNI library',sherpa.includes('System.loadLibrary("sherpa-onnx-jni")') && sherpa.includes('OfflineTtsSupertonicModelConfig')],
  ['Arabic and English are passed as local model languages',engine.includes('Collections.singletonMap("lang", language)')],
  ['Runtime and model downloads are pinned and verified',prep.includes('SHERPA_SHA256=') && prep.includes('MODEL_SHA256=') && prep.includes('sha256sum --check')],
  ['Model and runtime licenses are bundled',prep.includes('SHERPA-ONNX-LICENSE.txt') && prep.includes('ONNXRUNTIME-LICENSE.txt') && prep.includes('LLVM-LICENSE.txt') && prep.includes('supertonic3/LICENSE')],
  ['Android build includes Kotlin and uncompressed ONNX assets',gradle.includes("org.jetbrains.kotlin.android") && gradle.includes("noCompress += ['onnx', 'bin']")],
  ['APK workflow prepares embedded runtime before build',workflow.includes('bash scripts/prepare-embedded-tts.sh')],
  ['Parent voice controls retain Arabic, English, speed, test and stop',html.includes('voice-picker-select') && html.includes('voice-picker-ar-select') && html.includes('speech-rate-control') && html.includes('btn-test-voice') && html.includes('btn-stop-all-audio') && html.includes('btn-replay-question') && html.includes('btn-stop-question')]
];
const soundBlock=html.slice(html.indexOf('const JOLLY_SOUND_GROUPS'),html.indexOf('const JOLLY_TRICKY'));
const soundEntries=[...soundBlock.matchAll(/\['([^']+)','([^']+)'/g)].map(m=>m[1].toLowerCase()+'|'+m[2].toLowerCase());
const phonemeBlock=html.slice(html.indexOf('getJollyPhonemeData(sound, example)'),html.indexOf('  init() {',html.indexOf('getJollyPhonemeData(sound, example)')));
const phonemeKeys=new Set([...phonemeBlock.matchAll(/'([^']+\|[^']+)':\['/g)].map(m=>m[1]));
checks[checks.findIndex(x=>x[0]==='All 42 sound entries mapped')][1]=soundEntries.length===42 && soundEntries.every(k=>phonemeKeys.has(k));
const narrationStart=html.indexOf('const narrateQuestion = async () =>');
const narrationEnd=html.indexOf('this.renderQuestionType(q, area);',narrationStart);
const narration=narrationStart>=0?html.slice(narrationStart,narrationEnd):'';
checks[checks.findIndex(x=>x[0]==='Arabic helper spoken before answer selection')][1]=
  narration.includes('QuestionNarration.makeGuard(') &&
  narration.includes('const speakIf = (text, opts) => guard.say(text, opts)') &&
  narration.includes("if (arabicHelper) await speakIf(arabicHelper, { language: 'ar' })");
const interactionStart=html.indexOf('  renderQuestionType(q, container) {');
const interactionEnd=html.indexOf('  evaluateAnswer(q) {');
const interactions=interactionStart>=0&&interactionEnd>interactionStart?html.slice(interactionStart,interactionEnd):'';
checks.push(['Every answer interaction invalidates narration before acting',
  (interactions.split('this.invalidateQuestionNarration();').length - 1) >= 8]);
checks.push(['Page hide and backgrounding stop narration',
  html.includes("window.addEventListener('pagehide'") &&
  html.includes("document.addEventListener('visibilitychange'")]);
const answerStart=html.indexOf('  evaluateAnswer(q) {');
const answerEnd=html.indexOf('  advanceActivity() {',answerStart);
const answer=answerStart>=0&&answerEnd>answerStart?html.slice(answerStart,answerEnd):'';
checks[checks.findIndex(x=>x[0]==='No explanation or hint is emitted after submission')][1]=answer.length>0&&!answer.includes('q.explanation')&&!answer.includes('q.hint')&&!answer.includes('${explanation}')&&!answer.includes('${hint}');
checks.push(['Empty and repeated checks preserve current narration',
  answer.indexOf('if (this.answerLocked) return;') >= 0 &&
  answer.indexOf('this.selectedAnswer === null') >= 0 &&
  answer.indexOf('this.invalidateQuestionNarration();') > answer.indexOf('this.selectedAnswer === null')]);
checks.push(['Letter without mapped audio preserves the current narration guard',
  html.includes('Promise.resolve(guard.isCurrent())')]);
checks[checks.findIndex(x=>x[0]==='Correct and incorrect answers use encouragement only')][1]=answer.includes('أحسنت! إجابة صحيحة!')&&answer.includes('محاولة جميلة!')&&answer.includes("const spokenFeedback = isCorrect ? 'أحسنت!' : 'محاولة جميلة!';");
checks.push(['Option speech promises handle playback failures',
  /HybridSpeech\\.speak\\(opt\\)\\s*\\.catch\\(/.test(html) &&
  /playAliLetterSound\\(letter\\)[\\s\\S]*?\\.catch\\(/.test(html)]);
checks.push(['Continue button has a 700ms double-tap guard',
  answer.includes('submitBtn.disabled = true') && answer.includes('}, 700);')]);
const blending=html.indexOf("else if(skill==='blending')");
const study=html.indexOf("else if(skill==='wordstudy')");
const segmenting=html.indexOf("else if(skill==='segmenting')");
checks.push(['Question replay and stop controls disappear after answer',html.includes("audioControls.id = 'question-audio-controls'") && html.includes('id="btn-replay-question"') && html.includes('id="btn-stop-question"') && answer.includes("document.getElementById('question-audio-controls')")]);
checks.push(['Learning sections remain reachable',blending>=0&&study>blending&&segmenting>study]);
for(const [name,ok] of checks){if(!ok)throw new Error('Failed: '+name);console.log('PASS '+name);}
