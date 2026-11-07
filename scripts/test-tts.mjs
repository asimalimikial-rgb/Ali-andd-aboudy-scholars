import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('index.html','utf8');
const native=fs.readFileSync('android/app/src/main/java/com/alialiaboudyscholars/app/NativeSpeech.java','utf8');
const engine=fs.readFileSync('android/app/src/main/java/com/alialiaboudyscholars/app/EmbeddedTtsEngine.java','utf8');
const sherpa=fs.readFileSync('android/app/src/main/java/com/k2fsa/sherpa/onnx/Tts.kt','utf8');
const prep=fs.readFileSync('scripts/prepare-embedded-tts.sh','utf8');

assert.equal(html.includes('speechSynthesis'),false,'Web Speech API must never be used');
assert.equal(html.includes('<script src="tts-config.js"></script>'),false,'Deleted legacy remote TTS config must not be referenced');
assert.equal(html.includes('SpeechSynthesisUtterance'),false,'Browser speech utterances must never be used');
assert.equal(html.includes('/api/tts'),false,'No remote TTS endpoint may remain');
assert.equal(html.includes('freetts.org'),false,'No online speech provider may remain');
assert.equal(html.includes('fetchClip('),false,'No remote speech clip fetcher may remain');
assert.equal(html.includes('window.NativeSpeech.speak'),true,'All speech must use the app-owned native bridge');
assert.equal(native.includes('android.speech.tts'),false,'Android system TTS must not be imported');
assert.equal(native.includes('TextToSpeech'),false,'Android TextToSpeech must not be called');
assert.equal(native.includes('new EmbeddedTtsEngine(context)'),true,'Native bridge must instantiate embedded engine');
assert.equal(native.includes('if (style.startsWith(\"M\")) index += 5;'),true,'Supertonic SID order must map F1-F5 to 0-4 and M1-M5 to 5-9');
assert.equal(native.includes('AudioTrack'),true,'Generated PCM must be played through Android audio output');
assert.equal(native.includes('peak < 0.00001f'),true,'Silent generated PCM must be rejected instead of reported as success');
assert.equal(native.includes('getPlaybackHeadPosition()'),true,'Speech completion must wait for PCM frames to reach the playback head');
assert.equal(native.includes('track.setVolume(1.0f)'),true,'PCM playback must use full AudioTrack volume');
assert.equal(native.includes('track.getState() != AudioTrack.STATE_INITIALIZED'),true,'Uninitialized AudioTrack must fail visibly');
assert.equal(native.includes('PCM playback timed out'),true,'Playback timeout must be reported instead of false success');
assert.equal(native.includes('HttpURLConnection'),false,'Native TTS must not make HTTP calls');
assert.equal(engine.includes('OfflineTtsSupertonicModelConfig'),true,'Embedded engine must load Supertonic model');
assert.equal(engine.includes('Collections.singletonMap("lang", language)'),true,'Arabic/English language code must be passed to model');
assert.equal(sherpa.includes('System.loadLibrary("sherpa-onnx-jni")'),true,'Bundled sherpa JNI runtime must load');
assert.equal(prep.includes('SHERPA_SHA256=')&&prep.includes('MODEL_SHA256='),true,'Runtime/model versions must be pinned');
assert.equal(prep.includes('sha256sum --check'),true,'Runtime/model downloads must be hash-verified');
assert.equal(prep.includes('supertonic3/LICENSE'),true,'Model license must be bundled');
assert.equal(prep.includes('ONNXRUNTIME-LICENSE.txt')&&prep.includes('LLVM-LICENSE.txt'),true,'Native dependency licenses must be bundled');
assert.equal(html.includes('chk-ai-voice-terms'),true,'Parent must accept the model license before speech is enabled');
assert.equal(html.includes('aiVoiceTermsAccepted'),true,'Parent model-license acceptance must gate speech');
assert.equal(html.includes('Speech.stop=function(){HybridSpeech.stop();}'),false,'Speech stop must not recurse through the facade');
assert.equal(html.includes('أحسنت! إجابة صحيحة!'),true,'Correct answer must receive short praise');
assert.equal(html.includes('محاولة جميلة!'),true,'Incorrect answer must receive supportive feedback');
assert.equal(html.includes("const spokenFeedback = isCorrect ? 'Great job! أحسنت!' : 'Good try! محاولة جميلة!';"),true,'Post-answer speech must contain encouragement only');
assert.equal(html.includes("feedback.textContent = isCorrect\n      ? 'That’s right! / أحسنت! إجابة صحيحة!'\n      : 'Good try! / محاولة جميلة!';"),true,'Post-answer text must contain encouragement only');
assert.equal(html.includes('btn-replay-question')&&html.includes('btn-stop-question'),true,'Lesson screen must provide replay and stop controls before answer submission');
console.log('Embedded TTS checks passed: no Android/browser/network TTS, pinned offline model/runtime, native PCM playback, language routing, and feedback safeguards.');


// Runtime regression tests for cancellation, late native callbacks, and JS timeout.
const speechStart = html.indexOf('// @speech-start');
const speechEnd = html.indexOf('// @speech-end');
assert.ok(speechStart >= 0 && speechEnd > speechStart, 'Speech runtime extraction markers must exist');
const speechSource = html.slice(speechStart + '// @speech-start'.length, speechEnd);

function makeSpeechEnv() {
  const calls = [];
  const timers = [];
  let nextTimer = 1;
  const env = {
    console, Promise, Date, Math, JSON, String, Number, RegExp,
    Store: { data: { activeChild: 'ali', settings: { aiVoiceTermsAccepted: true, speechRate: 0.95 } } },
    SoundEffects: { init() {} },
    document: { getElementById: () => null, addEventListener() {} },
    window: {
      NativeSpeech: {
        speak: (id, text, language) => calls.push({ op: 'speak', id, text, language }),
        cancel: () => calls.push({ op: 'cancel' }),
        getVoices: () => '[]',
        getStatus: () => '{}',
        prewarm: () => calls.push({ op: 'prewarm' })
      }
    },
    setTimeout: (fn, ms) => {
      const id = nextTimer++;
      timers.push({ id, fn, ms, cleared: false });
      return id;
    },
    clearTimeout: id => {
      const timer = timers.find(item => item.id === id);
      if (timer) timer.cleared = true;
    }
  };
  vm.createContext(env);
  vm.runInContext(speechSource + '\nglobalThis.Speech = Speech;', env);
  env.Speech.getBestVoice = () => null;
  env.Speech.init();
  return {
    env, calls, timers,
    fire(id) {
      const timer = timers.find(item => item.id === id && !item.cleared);
      assert.ok(timer, 'Expected active timer ' + id);
      timer.cleared = true;
      timer.fn();
    }
  };
}

{
  const { env, calls } = makeSpeechEnv();
  const oldRequest = env.Speech.speak('Old question narration');
  const oldId = calls.find(item => item.op === 'speak').id;
  env.Speech.stop();
  await oldRequest;
  env.window.__nativeSpeechEvent(oldId, 'end');
  assert.equal(calls.filter(item => item.op === 'speak').length, 1,
    'A late native callback must not restart a cancelled narration chain');
  assert.ok(calls.some(item => item.op === 'cancel'),
    'Stopping a pending request must cancel the native bridge');
}

{
  const { env, calls, timers, fire } = makeSpeechEnv();
  const timeoutResult = env.Speech.speak('First run model load').then(
    () => 'resolved',
    error => error.message
  );
  const timeout = timers.find(item => !item.cleared && item.ms >= 30000);
  assert.ok(timeout, 'A native response timeout must be scheduled');
  fire(timeout.id);
  assert.equal(await timeoutResult, 'Embedded voice engine did not respond in time.');
  assert.ok(calls.some(item => item.op === 'cancel'),
    'The JavaScript timeout must cancel native generation/playback');
  const timedOutId = calls.find(item => item.op === 'speak').id;
  const speechCallsAfterTimeout = calls.filter(item => item.op === 'speak').length;
  env.window.__nativeSpeechEvent(timedOutId, 'end');
  assert.equal(calls.filter(item => item.op === 'speak').length, speechCallsAfterTimeout,
    'A late native callback after timeout must not restart speech');
}

{
  const { env, calls, timers, fire } = makeSpeechEnv();
  const guardSource = html.match(/const QuestionNarration = \{[\s\S]*?\n\};/);
  assert.ok(guardSource, 'Shared question narration guard must exist');
  env.HybridSpeech = {
    speak: (text, opts) => env.Speech.speak(text, opts || {}),
    stop: () => env.Speech.stop()
  };
  vm.runInContext(guardSource[0] + '\nglobalThis.Guard = QuestionNarration;', env);
  const fireSpeechTick = () => {
    const timer = timers.find(item => !item.cleared && item.ms === 80);
    assert.ok(timer, 'Expected the native end callback to schedule the next narration tick');
    fire(timer.id);
  };

  // The shared guard also respects the answer-locked state.
  const blocked = env.Guard.makeGuard(() => false);
  const callsBeforeBlockedSay = calls.filter(item => item.op === 'speak').length;
  assert.equal(await blocked.say('Must not speak after submission'), false);
  assert.equal(calls.filter(item => item.op === 'speak').length, callsBeforeBlockedSay,
    'Answer-locked state must prevent new narration requests');

  // A silent answer choice must cancel the question and suppress the Arabic helper.
  const silentQuestion = env.Guard.makeGuard();
  const silentQuestionPromise = silentQuestion.say('Question before silent choice');
  const silentQuestionId = calls.filter(item => item.op === 'speak').at(-1).id;
  env.Guard.invalidate();
  env.HybridSpeech.stop(); // the selected compare/true-false option has no voice of its own
  env.window.__nativeSpeechEvent(silentQuestionId, 'end');
  assert.equal(await silentQuestionPromise, false,
    'A silent choice must cancel the in-flight question narration');
  const speechCountAfterSilentChoice = calls.filter(item => item.op === 'speak').length;
  assert.equal(await silentQuestion.say('Arabic helper after silent choice'), false,
    'The Arabic helper must not start after a silent choice');
  assert.equal(calls.filter(item => item.op === 'speak').length, speechCountAfterSilentChoice,
    'Silent choice must not enqueue any new speech');

  // Two rapid replays: only the newest narration remains valid.
  const first = env.Guard.makeGuard();
  const firstPromise = first.say('First replay prompt');
  const firstId = calls.filter(item => item.op === 'speak').at(-1).id;
  const second = env.Guard.makeGuard();
  assert.equal(first.isCurrent(), false, 'A new replay must invalidate the older sequence');
  const secondPromise = second.say('Second replay prompt');
  const secondId = calls.filter(item => item.op === 'speak').at(-1).id;
  env.window.__nativeSpeechEvent(firstId, 'end');
  assert.equal(await firstPromise, false, 'The older replay must not continue');
  env.window.__nativeSpeechEvent(secondId, 'end');
  fireSpeechTick();
  assert.equal(await secondPromise, true, 'The newest replay must complete');

  // Selection interrupts the question and prevents the Arabic helper from starting.
  const question = env.Guard.makeGuard();
  const questionPromise = question.say('English question');
  const questionId = calls.filter(item => item.op === 'speak').at(-1).id;
  env.Guard.invalidate();
  env.HybridSpeech.stop();
  const optionPromise = env.HybridSpeech.speak('Chosen option');
  const optionId = calls.filter(item => item.op === 'speak').at(-1).id;
  env.window.__nativeSpeechEvent(questionId, 'end');
  assert.equal(await questionPromise, false, 'Selection must invalidate in-flight question narration');
  assert.equal(await question.say('Arabic helper', { language: 'ar' }), false,
    'Arabic helper must not start after selection');
  env.window.__nativeSpeechEvent(optionId, 'end');
  fireSpeechTick();
  await optionPromise;
  assert.deepEqual(calls.filter(item => item.op === 'speak').map(item => item.text),
    ['First replay prompt', 'Second replay prompt', 'English question', 'Chosen option'],
    'No stale helper speech may be queued after the selected option');

  const renderStart = html.indexOf('  renderQuestionType(q, container) {');
  const renderEnd = html.indexOf('  evaluateAnswer(q) {', renderStart);
  const render = html.slice(renderStart, renderEnd);
  for (const pattern of [
    /btn\.onclick = \(\) => \{\s*this\.invalidateQuestionNarration\(\);/,
    /select\.onchange = \(\) => \{\s*this\.invalidateQuestionNarration\(\);/,
    /item\.onclick = \(\) => \{\s*this\.invalidateQuestionNarration\(\);/,
    /tile\.onclick = \(\) => \{\s*this\.invalidateQuestionNarration\(\);/,
    /const startDraw = \(\) => \{\s*this\.invalidateQuestionNarration\(\);/
  ]) assert.match(render, pattern, 'Every answer interaction must cancel question narration first');

  const compareStart = render.indexOf("case 'compare'");
  const compareEnd = render.indexOf("case 'match_pairs'", compareStart);
  const compareHandler = render.slice(compareStart, compareEnd);
  assert.match(compareHandler, /btn\.onclick = \(\) => \{\s*this\.invalidateQuestionNarration\(\);/,
    'A silent answer option must cancel narration immediately');
  assert.equal(compareHandler.includes('HybridSpeech.speak('), false,
    'The silent compare option must not start replacement speech');

  const answerBlock = html.slice(html.indexOf('  evaluateAnswer(q) {'), html.indexOf('  advanceActivity() {'));
  assert.match(answerBlock, /evaluateAnswer\(q\) \{\s*this\.invalidateQuestionNarration\(\);/,
    'Check Answer must cancel question narration immediately');
  assert.equal((answerBlock.match(/HybridSpeech\.speak\(/g) || []).length, 1,
    'Post-answer handling must speak only the final encouragement');
  assert.ok(answerBlock.indexOf('HybridSpeech.speak(spokenFeedback)') >
    answerBlock.indexOf('this.invalidateQuestionNarration();'),
    'Post-answer encouragement must occur after question narration is cancelled');
  assert.ok(html.includes("document.addEventListener('visibilitychange'") &&
    html.includes("window.addEventListener('pagehide'"),
    'Hiding or unloading the page must cancel queued speech');
  const currentQuestion = html.slice(html.indexOf('  renderCurrentQuestion() {'), html.indexOf('  renderQuestionType(q, container) {'));
  assert.ok(currentQuestion.includes('this.invalidateQuestionNarration();'),
    'Changing the question must invalidate speech from the previous question');
  assert.ok(html.includes("document.getElementById('btn-test-voice').onclick = () => this.testVoiceDoctor();") &&
    (html.match(/this\.testVoiceDoctor\(\)/g) || []).length === 1,
    'Voice test must only be started by an explicit button press');
  assert.ok(html.includes("Welcome narration failed:"),
    'The profile welcome narration must handle rejected promises');
}

assert.ok(native.includes('if (request != generation.get()) {\n                    notifyJs(requestId, "end");\n                    return;\n                }'),
  'Stale native requests must not overwrite engine readiness or report current-request errors');
assert.ok(native.includes('public void prewarm()'),
  'Native bridge must support background model prewarming');
assert.ok(native.includes('if (request != generation.get()) {\n                    notifyJs(id, "end");\n                    return;\n                }'),
  'AudioTrack must not be registered for a stale generation');

console.log('Speech runtime regression checks passed: timeout cancellation, stop, stale callback, narration invalidation, native prewarm, and stale-request handling.');
