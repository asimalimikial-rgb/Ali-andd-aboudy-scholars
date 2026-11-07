package com.alialiaboudyscholars.app;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;

public class MainActivity extends Activity {
    private WebView webView;
    private NativeSpeech nativeSpeech;
    private boolean ciAudioTest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ciAudioTest = ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0)
            && getIntent().getBooleanExtra("ci_audio_test", false);
        webView = new WebView(this);
        if (Build.VERSION.SDK_INT >= 35) {
            webView.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        nativeSpeech = new NativeSpeech(this, webView);
        webView.addJavascriptInterface(nativeSpeech, "NativeSpeech");
        if (ciAudioTest) webView.addJavascriptInterface(new EmulatorTestBridge(), "EmulatorTestBridge");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if ("file".equals(scheme) || "about".equals(scheme)) return false;
                if ("https".equals(scheme) || "http".equals(scheme)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                    return true;
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (ciAudioTest) {
                    view.postDelayed(() -> view.evaluateJavascript(
                        "(function(){try{" +
                        "var a=document.getElementById('chk-ai-voice-terms');" +
                        "if(!a){EmulatorTestBridge.report('CI_RESULT:missing-license-checkbox');return;}" +
                        "a.checked=true;" +
                        "a.dispatchEvent(new Event('change',{bubbles:true}));" +
                        "window.__voiceDoctorCompleted=false;" +
                        "var b=document.getElementById('btn-test-voice');" +
                        "if(!b){EmulatorTestBridge.report('CI_RESULT:missing-test-button');return;}" +
                        "b.click();" +
                        "var started=Date.now();" +
                        "function pollVoiceDoctor(){" +
                        "if(window.__voiceDoctorCompleted){var d='';" +
                        "try{d=Speech.getDiagnostics();}catch(e){d='diagnostics-error:'+String(e);}" +
                        "var h=document.getElementById('hybrid-voice-status');" +
                        "var l=document.getElementById('local-voice-status');" +
                        "var s=(h&&h.textContent)||(l&&l.textContent)||'';" +
                        "EmulatorTestBridge.report('CI_RESULT:'+JSON.stringify({diagnostics:d,status:s,licenseAccepted:!!a.checked,consentScope:'debug-emulator-only',testCompleted:true}));return;}" +
                        "if(Date.now()-started>240000){EmulatorTestBridge.report('CI_RESULT:'+JSON.stringify({diagnostics:Speech.getDiagnostics(),status:'Voice Doctor exceeded 240 seconds',testCompleted:false}));return;}" +
                        "window.setTimeout(pollVoiceDoctor,1000);}" +
                        "window.setTimeout(pollVoiceDoctor,500);" +
                        "}catch(e){EmulatorTestBridge.report('CI_RESULT:exception:'+String(e));}})();",
                        null), 2500);
                }
            }
        });
        setContentView(webView);
        if (savedInstanceState == null) webView.loadUrl("file:///android_asset/index.html");
        else webView.restoreState(savedInstanceState);
    }

    private final class EmulatorTestBridge {
        @JavascriptInterface
        public void report(String diagnostics) {
            Log.i("CI_AUDIO_TEST", diagnostics == null ? "" : diagnostics);
        }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (nativeSpeech != null) nativeSpeech.shutdown();
        if (webView != null) {
            webView.removeJavascriptInterface("NativeSpeech");
            if (ciAudioTest) webView.removeJavascriptInterface("EmulatorTestBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
