(function () {
  if (!window.NativeSpeech) return;
  const pending = new Map();
  let sequence = 0;
  class LocalSpeechUtterance {
    constructor(text = '') {
      this.text = String(text); this.lang = 'en-GB'; this.voice = null;
      this.rate = 1; this.pitch = 1; this.volume = 1;
      this.onstart = null; this.onend = null; this.onerror = null;
    }
  }
  const callHandler = (utterance, eventName, type) => {
    const handler = utterance[`on${eventName}`];
    if (typeof handler === 'function') {
      try { handler.call(utterance, { type, target: utterance }); }
      catch (error) { console.error('Speech callback failed', error); }
    }
  };
  const synthesis = {
    onvoiceschanged: null, _voices: [],
    getVoices() {
      try {
        const current = JSON.parse(window.NativeSpeech.getVoices());
        if (Array.isArray(current)) this._voices = current;
      } catch (error) { this._voices = []; }
      return this._voices.slice();
    },
    refreshVoices() {
      this.getVoices();
      if (typeof this.onvoiceschanged === 'function')
        this.onvoiceschanged.call(this, { type: 'voiceschanged', target: this });
    },
    speak(utterance) {
      const id = `local-${Date.now()}-${++sequence}`;
      pending.set(id, utterance);
      const selectedVoice = utterance.voice && utterance.voice.name ? utterance.voice.name : '';
      try {
        window.NativeSpeech.speak(id, utterance.text, utterance.lang || 'en-GB',
          selectedVoice, Number(utterance.rate) || 1, Number(utterance.pitch) || 1);
      } catch (error) { this._finish(id, 'error'); }
    },
    cancel() {
      try { window.NativeSpeech.cancel(); } catch (error) {}
      for (const [id] of pending) this._finish(id, 'error');
    },
    pause() {}, resume() {},
    get speaking() { return pending.size > 0; },
    get pending() { return false; },
    get paused() { return false; },
    _finish(id, eventName) {
      const utterance = pending.get(id);
      if (!utterance) return;
      pending.delete(id);
      callHandler(utterance, eventName, eventName === 'end' ? 'end' : 'error');
    },
    _handleNativeEvent(id, eventName) {
      if (!pending.has(id)) return;
      if (eventName === 'start') callHandler(pending.get(id), 'start', 'start');
      else this._finish(id, eventName === 'end' ? 'end' : 'error');
    }
  };
  window.SpeechSynthesisUtterance = LocalSpeechUtterance;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  window.__nativeSpeechEvent = (id, eventName) => synthesis._handleNativeEvent(id, eventName);
  window.__nativeSpeechReady = () => synthesis.refreshVoices();
  synthesis.getVoices();
})();
