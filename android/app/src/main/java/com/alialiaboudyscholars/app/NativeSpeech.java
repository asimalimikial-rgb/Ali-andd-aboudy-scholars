package com.alialiaboudyscholars.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.k2fsa.sherpa.onnx.GeneratedAudio;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * JavaScript bridge for the bundled sherpa-onnx/Supertonic runtime.
 * Deliberately contains no platform speech engine or network speech fallback.
 */
public final class NativeSpeech {
    private final Context context;
    private final WebView webView;
    private final Object workerLock = new Object();
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0L,
        TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>());
    private volatile Runnable queuedSpeechTask;
    private final AtomicLong generation = new AtomicLong(0);
    private final Object audioLock = new Object();
    private volatile EmbeddedTtsEngine engine;
    private volatile AudioTrack activeTrack;
    private volatile String lastError = "";
    private volatile boolean ready = false;
    private final StringBuilder nativeLog = new StringBuilder();

    NativeSpeech(Context context, WebView webView) {
        this.context = context.getApplicationContext();
        this.webView = webView;
    }

    @JavascriptInterface public String getVoices() {
        JSONArray voices = new JSONArray();
        try {
            String[] styles = new String[]{"M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"};
            for (String language : new String[]{"en", "ar"}) {
                for (String style : styles) {
                    JSONObject voice = new JSONObject();
                    voice.put("name", style);
                    voice.put("lang", language.equals("ar") ? "ar" : "en");
                    voice.put("localService", true);
                    voices.put(voice);
                }
            }
        } catch (Exception ignored) {}
        return voices.toString();
    }

    private synchronized void logNative(String message) {
        nativeLog.append(android.os.SystemClock.elapsedRealtime()).append(' ').append(message == null ? "" : message).append('\n');
        if (nativeLog.length() > 8000) nativeLog.delete(0, nativeLog.length() - 6000);
        Log.i("NativeSpeech", message == null ? "" : message);
    }

    @JavascriptInterface public synchronized String getNativeLog() {
        return nativeLog.toString();
    }

    @JavascriptInterface public String getStatus() {
        try {
            JSONObject status = new JSONObject();
            status.put("ready", ready);
            status.put("message", ready ? "Embedded offline voice ready" :
                (lastError.isEmpty() ? "Embedded offline voice will initialize on first use" : lastError));
            return status.toString();
        } catch (Exception ignored) { return "{\"ready\":false}"; }
    }

    @JavascriptInterface public void prewarm() {
        final long queued = android.os.SystemClock.elapsedRealtime();
        logNative("prewarm-enqueued");
        synchronized (workerLock) {
            if (worker.getActiveCount() > 0 || !worker.getQueue().isEmpty()) {
                logNative("prewarm-skipped worker-busy active=" + worker.getActiveCount() +
                    " queued=" + worker.getQueue().size());
                return;
            }
            worker.execute(() -> {
            final long workerStart = android.os.SystemClock.elapsedRealtime();
            logNative("prewarm-worker-start queue-ms=" + (workerStart - queued));
            if (engine != null) { logNative("prewarm-skipped engine=ready"); return; }
            final long loadStart = android.os.SystemClock.elapsedRealtime();
            try {
                notifyStatus("Loading the embedded offline voice… / جارٍ تحميل محرك الصوت المضمّن…");
                logNative("prewarm-engine-load-start " + EmbeddedTtsEngine.configSummary());
                engine = new EmbeddedTtsEngine(context);
                ready = true;
                lastError = "";
                logNative("prewarm-engine-load-end load-ms=" + (android.os.SystemClock.elapsedRealtime() - loadStart));
                notifyStatus("");
            } catch (Throwable error) {
                ready = false;
                lastError = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
                logNative("prewarm-engine-load-error load-ms=" + (android.os.SystemClock.elapsedRealtime() - loadStart) + " error=" + lastError);
                notifyStatus("Embedded offline voice initialization failed / تعذّر تهيئة محرك الصوت المضمّن: " + lastError);
            }
            });
        }
    }

    @JavascriptInterface public void speak(String id, String text, String language,
                                           String voiceName, float rate, float pitch) {
        final long queued = android.os.SystemClock.elapsedRealtime();
        final long request = generation.incrementAndGet();
        final String requestId = id == null ? "" : id;
        final String content = text == null ? "" : text.trim();
        final String lang = language != null && language.toLowerCase().startsWith("ar") ? "ar" : "en";
        final int voiceId = parseVoiceId(voiceName);
        logNative("request-enqueued id=" + requestId + " chars=" + content.length() + " lang=" + lang);
        if (content.isEmpty()) { notifyJs(requestId, "end"); return; }

        final Runnable[] taskRef = new Runnable[1];
        Runnable speechTask = () -> {
            synchronized (workerLock) {
                if (queuedSpeechTask == taskRef[0]) queuedSpeechTask = null;
            }
            logNative("request-worker-start id=" + requestId + " queue-ms=" +
                (android.os.SystemClock.elapsedRealtime() - queued));
            try {
                if (request != generation.get()) {
                    logNative("request-cancelled-before-start id=" + requestId);
                    notifyJs(requestId, "cancelled");
                    return;
                }
                EmbeddedTtsEngine active = engine;
                if (active == null) {
                    long loadStart = android.os.SystemClock.elapsedRealtime();
                    notifyJs(requestId, "load-start");
                    notifyStatus("Loading the embedded offline voice… / جارٍ تحميل محرك الصوت المضمّن…");
                    logNative("engine-load-start id=" + requestId + " " + EmbeddedTtsEngine.configSummary());
                    active = new EmbeddedTtsEngine(context);
                    engine = active;
                    ready = true;
                    lastError = "";
                    long loadMs = android.os.SystemClock.elapsedRealtime() - loadStart;
                    logNative("engine-load-end id=" + requestId + " load-ms=" + loadMs);
                    notifyJs(requestId, "load-end:" + loadMs);
                    notifyStatus("");
                }
                if (request != generation.get()) {
                    logNative("request-cancelled-after-load id=" + requestId);
                    notifyJs(requestId, "cancelled");
                    return;
                }
                notifyJs(requestId, "synth-start");
                long synthStart = android.os.SystemClock.elapsedRealtime();
                logNative("synth-start id=" + requestId + " chars=" + content.length() + " lang=" + lang);
                GeneratedAudio audio = active.synthesize(content, lang, voiceId, rate);
                long synthMs = android.os.SystemClock.elapsedRealtime() - synthStart;
                float[] samples = audio == null ? null : audio.getSamples();
                int sampleRate = audio == null ? 0 : audio.getSampleRate();
                long durationMs = samples == null || sampleRate <= 0 ? 0L : (samples.length * 1000L) / sampleRate;
                logNative("synth-end id=" + requestId + " synth-ms=" + synthMs +
                    " samples=" + (samples == null ? 0 : samples.length) +
                    " sample-rate=" + sampleRate + " duration-ms=" + durationMs);
                notifyJs(requestId, "synth-end:" + synthMs + ":samples=" +
                    (samples == null ? 0 : samples.length) + ":rate=" + sampleRate + ":duration-ms=" + durationMs);
                if (request != generation.get()) {
                    logNative("request-cancelled-after-synthesis id=" + requestId);
                    notifyJs(requestId, "cancelled");
                    return;
                }
                playAudio(requestId, audio, request);
            } catch (Throwable error) {
                if (request != generation.get()) {
                    logNative("request-cancelled-during-error id=" + requestId);
                    notifyJs(requestId, "cancelled");
                    return;
                }
                ready = false;
                lastError = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
                logNative("native-error id=" + requestId + " type=" + error.getClass().getSimpleName() + " message=" + lastError);
                notifyStatus("Embedded offline speech failed / تعذّر تشغيل محرك الصوت المضمّن: " + lastError);
                notifyJs(requestId, "error");
            }
        };
        taskRef[0] = speechTask;
        synchronized (workerLock) {
            if (queuedSpeechTask != null && worker.remove(queuedSpeechTask)) {
                logNative("queued-speech-replaced by=" + requestId);
            }
            queuedSpeechTask = speechTask;
            worker.execute(speechTask);
        }
    }

    private void playAudio(String id, GeneratedAudio audio, long request) {
        float[] samples = audio == null ? null : audio.getSamples();
        int sampleRate = audio == null ? 0 : audio.getSampleRate();
        if (samples == null || samples.length == 0 || sampleRate <= 0) {
            throw new IllegalStateException("The embedded TTS engine returned empty audio.");
        }
        long durationMs = (samples.length * 1000L) / sampleRate;
        float peak = 0.0f;
        for (float sample : samples) if (Float.isFinite(sample)) peak = Math.max(peak, Math.abs(sample));
        logNative("audio-ready id=" + id + " samples=" + samples.length +
            " sample-rate=" + sampleRate + " duration-ms=" + durationMs + " peak=" + peak);
        if (peak < 0.00001f) throw new IllegalStateException("The voice model generated silent PCM audio (peak=" + peak + ").");

        int minBuffer = AudioTrack.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT);
        if (minBuffer <= 0) throw new IllegalStateException("This device cannot play generated PCM audio: minBuffer=" + minBuffer);
        int bufferBytes = Math.max(minBuffer, 8192 * 4);
        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                .setSampleRate(sampleRate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setBufferSizeInBytes(bufferBytes).setTransferMode(AudioTrack.MODE_STREAM).build();

        final long playbackStart;
        try {
            synchronized (audioLock) {
                if (request != generation.get()) {
                    logNative("audio-cancelled-before-track id=" + id);
                    notifyJs(id, "cancelled");
                    return;
                }
                activeTrack = track;
            }
            if (track.getState() != AudioTrack.STATE_INITIALIZED)
                throw new IllegalStateException("AudioTrack failed to initialize for " + sampleRate + " Hz PCM.");
            track.setVolume(1.0f);
            track.play();
            if (track.getPlayState() != AudioTrack.PLAYSTATE_PLAYING)
                throw new IllegalStateException("Android did not start PCM playback.");
            playbackStart = android.os.SystemClock.elapsedRealtime();
            logNative("audio-start id=" + id + " duration-ms=" + durationMs +
                " track-state=" + track.getState() + " play-state=" + track.getPlayState());
            notifyJs(id, "start:" + durationMs);

            final int chunk = 4096;
            for (int offset = 0; offset < samples.length && request == generation.get(); offset += chunk) {
                int count = Math.min(chunk, samples.length - offset);
                int writtenTotal = 0;
                long deadline = android.os.SystemClock.elapsedRealtime() + 5000;
                while (writtenTotal < count && request == generation.get()) {
                    int written = track.write(samples, offset + writtenTotal, count - writtenTotal, AudioTrack.WRITE_BLOCKING);
                    if (written < 0) throw new IllegalStateException("AudioTrack write failed: " + written);
                    if (written == 0) {
                        if (android.os.SystemClock.elapsedRealtime() > deadline)
                            throw new IllegalStateException("AudioTrack stopped accepting PCM samples.");
                        try { Thread.sleep(10); } catch (InterruptedException interrupted) {
                            Thread.currentThread().interrupt();
                            throw new IllegalStateException("PCM playback was interrupted.", interrupted);
                        }
                        continue;
                    }
                    writtenTotal += written;
                }
            }
            if (request == generation.get()) {
                long playbackDeadline = android.os.SystemClock.elapsedRealtime() + Math.max(5000L, durationMs + 5000L);
                int playedFrames = 0;
                while (request == generation.get() && playedFrames < samples.length &&
                    android.os.SystemClock.elapsedRealtime() < playbackDeadline) {
                    playedFrames = track.getPlaybackHeadPosition();
                    if (track.getPlayState() != AudioTrack.PLAYSTATE_PLAYING)
                        throw new IllegalStateException("PCM playback stopped before all generated audio was rendered.");
                    try { Thread.sleep(20); } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Waiting for PCM playback was interrupted.", interrupted);
                    }
                }
                if (request == generation.get() && playedFrames < samples.length)
                    throw new IllegalStateException("PCM playback timed out: rendered " + playedFrames + " of " + samples.length + " frames.");
                if (request == generation.get()) {
                    track.stop();
                    logNative("audio-complete id=" + id + " rendered-frames=" + playedFrames +
                        " total-frames=" + samples.length + " playback-ms=" +
                        (android.os.SystemClock.elapsedRealtime() - playbackStart));
                    notifyJs(id, "end");
                }
            } else {
                try { track.stop(); } catch (Exception ignored) {}
                logNative("audio-cancelled id=" + id);
                notifyJs(id, "cancelled");
            }
        } finally {
            synchronized (audioLock) { if (activeTrack == track) activeTrack = null; }
            track.release();
        }
    }

    @JavascriptInterface public void cancel() {
        long cancelledGeneration = generation.incrementAndGet();
        logNative("cancel generation=" + cancelledGeneration);
        synchronized (audioLock) {
            if (activeTrack != null) {
                try { activeTrack.pause(); activeTrack.flush(); activeTrack.stop(); } catch (Exception ignored) {}
            }
        }
    }

    private int parseVoiceId(String name) {
        if (name == null) return 0;
        try {
            String style = name.trim().toUpperCase();
            String digits = style.replaceAll("[^0-9]", "");
            if (digits.isEmpty()) return 0;
            int index = Integer.parseInt(digits) - 1;
            if (style.startsWith("M")) index += 5;
            return Math.max(0, Math.min(9, index));
        } catch (Exception ignored) { return 0; }
    }

    private void notifyStatus(String message) {
        final String safe = JSONObject.quote(message == null ? "" : message);
        webView.post(() -> webView.evaluateJavascript(
            "if(window.__nativeSpeechStatus)window.__nativeSpeechStatus(" + safe + ");" +
            "if(window.__nativeSpeechReady)window.__nativeSpeechReady();", null));
    }

    private void notifyJs(String id, String event) {
        final String safeId = JSONObject.quote(id == null ? "" : id);
        final String safeEvent = JSONObject.quote(event);
        webView.post(() -> webView.evaluateJavascript(
            "if(window.__nativeSpeechEvent)window.__nativeSpeechEvent(" + safeId + "," + safeEvent + ");", null));
    }

    void shutdown() {
        cancel();
        synchronized (workerLock) {
            worker.getQueue().clear();
            queuedSpeechTask = null;
            worker.execute(() -> {
                EmbeddedTtsEngine current = engine;
                engine = null;
                ready = false;
                if (current != null) current.close();
            });
            worker.shutdown();
        }
    }
}
