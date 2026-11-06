package com.alialiaboudyscholars.app;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.os.Bundle;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class NativeSpeech {
    private final Context context;
    private final WebView webView;
    private TextToSpeech tts;
    private volatile boolean ready = false;

    NativeSpeech(Context context, WebView webView) {
        this.context = context.getApplicationContext();
        this.webView = webView;
        tts = new TextToSpeech(this.context, status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { notifyJs(id, "start"); }
                    @Override public void onDone(String id) { notifyJs(id, "end"); }
                    @Override public void onError(String id) { notifyJs(id, "error"); }
                    @Override public void onError(String id, int code) { notifyJs(id, "error"); }
                });
            }
            webView.post(() -> webView.evaluateJavascript(
                "if(window.__nativeSpeechReady)window.__nativeSpeechReady();", null));
        });
    }

    @JavascriptInterface public String getVoices() {
        JSONArray result = new JSONArray();
        try {
            if (tts == null || !ready) return result.toString();
            Set<Voice> voices = tts.getVoices();
            if (voices == null) return result.toString();
            for (Voice voice : voices) {
                JSONObject item = new JSONObject();
                item.put("name", voice.getName());
                item.put("lang", voice.getLocale().toLanguageTag());
                item.put("localService", !voice.isNetworkConnectionRequired());
                result.put(item);
            }
        } catch (Exception ignored) {}
        return result.toString();
    }

    @JavascriptInterface public void speak(String id, String text, String language, String voiceName, float rate, float pitch) {
        webView.post(() -> {
            try {
                if (tts == null || !ready) { notifyJs(id, "error"); return; }
                String languageTag = language == null ? "en-GB" : language;
                Locale locale = Locale.forLanguageTag(languageTag);
                int languageStatus = tts.setLanguage(locale);
                if (languageStatus == TextToSpeech.LANG_MISSING_DATA ||
                    languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Locale fallbackLocale = languageTag.toLowerCase().startsWith("ar")
                        ? new Locale("ar") : Locale.UK;
                    languageStatus = tts.setLanguage(fallbackLocale);
                }
                if (languageStatus == TextToSpeech.LANG_MISSING_DATA ||
                    languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
                    notifyJs(id, "error");
                    return;
                }
                if (voiceName != null && !voiceName.isEmpty()) {
                    Set<Voice> voices = tts.getVoices();
                    if (voices != null) for (Voice voice : voices) {
                        if (voiceName.equals(voice.getName()) && !voice.isNetworkConnectionRequired()) {
                            tts.setVoice(voice); break;
                        }
                    }
                }
                tts.setSpeechRate(Math.max(0.65f, Math.min(1.25f, rate)));
                tts.setPitch(Math.max(0.75f, Math.min(1.25f, pitch)));
                Bundle params = new Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id);
            } catch (Exception error) { notifyJs(id, "error"); }
        });
    }

    @JavascriptInterface public void cancel() {
        webView.post(() -> { try { if (tts != null) tts.stop(); } catch (Exception ignored) {} });
    }

    private void notifyJs(String id, String event) {
        final String safeId = JSONObject.quote(id == null ? "" : id);
        final String safeEvent = JSONObject.quote(event);
        webView.post(() -> webView.evaluateJavascript(
            "if(window.__nativeSpeechEvent)window.__nativeSpeechEvent(" + safeId + "," + safeEvent + ");", null));
    }

    void shutdown() {
        try { if (tts != null) { tts.stop(); tts.shutdown(); } } catch (Exception ignored) {}
        ready = false;
    }
}
