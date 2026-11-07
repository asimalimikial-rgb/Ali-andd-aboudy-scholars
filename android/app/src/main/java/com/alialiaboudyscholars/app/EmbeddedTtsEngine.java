package com.alialiaboudyscholars.app;

import android.content.Context;
import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.GenerationConfig;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsSupertonicModelConfig;
import java.util.Collections;

/** Fully embedded Supertonic 3 runtime. No Android TTS or network services are used. */
final class EmbeddedTtsEngine {
    private static final String MODEL_DIR = "embedded-tts/supertonic3";
    static final int NUM_THREADS = 2;
    static final int NUM_STEPS = 8;
    static final String PROVIDER = "cpu";

    static String configSummary() {
        return "provider=" + PROVIDER + " numThreads=" + NUM_THREADS + " numSteps=" + NUM_STEPS + " model=Supertonic3-int8";
    }
    private final OfflineTts tts;

    EmbeddedTtsEngine(Context context) {
        OfflineTtsSupertonicModelConfig supertonic = new OfflineTtsSupertonicModelConfig();
        supertonic.setDurationPredictor(MODEL_DIR + "/duration_predictor.int8.onnx");
        supertonic.setTextEncoder(MODEL_DIR + "/text_encoder.int8.onnx");
        supertonic.setVectorEstimator(MODEL_DIR + "/vector_estimator.int8.onnx");
        supertonic.setVocoder(MODEL_DIR + "/vocoder.int8.onnx");
        supertonic.setTtsJson(MODEL_DIR + "/tts.json");
        supertonic.setUnicodeIndexer(MODEL_DIR + "/unicode_indexer.bin");
        supertonic.setVoiceStyle(MODEL_DIR + "/voice.bin");

        OfflineTtsModelConfig model = new OfflineTtsModelConfig();
        model.setSupertonic(supertonic);
        model.setNumThreads(NUM_THREADS);
        model.setDebug(false);
        model.setProvider(PROVIDER);

        OfflineTtsConfig config = new OfflineTtsConfig();
        config.setModel(model);
        config.setMaxNumSentences(1);
        config.setSilenceScale(0.2f);
        tts = new OfflineTts(context.getAssets(), config);
    }

    GeneratedAudio synthesize(String text, String language, int voiceId, float speed) {
        GenerationConfig generation = new GenerationConfig();
        generation.setSid(Math.max(0, Math.min(9, voiceId)));
        generation.setNumSteps(NUM_STEPS);
        generation.setSpeed(Math.max(0.70f, Math.min(1.20f, speed)));
        generation.setSilenceScale(0.2f);
        generation.setExtra(Collections.singletonMap("lang", language));
        return tts.generateWithConfig(text, generation);
    }

    void close() {
        tts.release();
    }
}
