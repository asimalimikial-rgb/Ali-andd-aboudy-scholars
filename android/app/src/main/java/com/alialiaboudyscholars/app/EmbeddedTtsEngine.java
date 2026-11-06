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
        model.setNumThreads(2);
        model.setDebug(false);
        model.setProvider("cpu");

        OfflineTtsConfig config = new OfflineTtsConfig();
        config.setModel(model);
        config.setMaxNumSentences(1);
        config.setSilenceScale(0.2f);
        tts = new OfflineTts(context.getAssets(), config);
    }

    GeneratedAudio synthesize(String text, String language, int voiceId, float speed) {
        GenerationConfig generation = new GenerationConfig();
        generation.setSid(Math.max(0, Math.min(9, voiceId)));
        generation.setNumSteps(8);
        generation.setSpeed(Math.max(0.70f, Math.min(1.20f, speed)));
        generation.setSilenceScale(0.2f);
        generation.setExtra(Collections.singletonMap("lang", language));
        return tts.generateWithConfig(text, generation);
    }

    void close() {
        tts.release();
    }
}
