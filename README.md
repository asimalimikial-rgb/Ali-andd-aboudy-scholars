# Ali & Aboudy Scholars — v1.3.0

تطبيق تعليمي شخصي لعلي (KG2) وعبودي (Grade 2)، بملفي تعلم منفصلين، مناهج متكاملة، ألعاب قصيرة، ومساعد صوتي ثنائي اللغة.

## محتويات المشروع

- `index.html`: تطبيق الويب الأساسي، مع الدروس والمناهج والصور الأصلية المضمنة.
- `api/tts.js`: وسيط آمن إلى Microsoft Azure AI Speech Neural TTS.
- `tts-config.js`: عنوان خدمة الصوت لنسخة الويب.
- `android/`: غلاف Android WebView مع Android Native Text-to-Speech كحل أخير.
- `.github/workflows/build-apk.yml`: فحوص JavaScript وبناء APK موقّع ونشر GitHub Release.
- `tts-config.android.js`: عنوان خدمة الصوت الذي يُضمّن في APK.

## بيئة التعلّم

- ثلاثة مداخل واضحة تجمع الدروس: English & Phonics، Mathematics، Science & Discovery.
- الحفاظ على كتب المنهج الأصلية والدروس ومعرّفاتها وتسلسل فتح الدروس.
- ملفات مستقلة لعلي KG2 وعبودي Grade 2.
- Jolly Phonics، Phonics Studio، Reading Adventure، Math Playground، Little Science Lab.
- Play & Learn، Daily Challenge، Smart Learning Coach، My Word Collector، الألعاب والإنجازات.
- Parent Dashboard، إعدادات الصوت، النسخ الاحتياطي والاستعادة.
- واجهة متجاوبة للهاتف واللوحي والكمبيوتر.

## سياسة الصوت

1. عند توفر الإنترنت، يطلب التطبيق Microsoft Azure AI Speech أولاً.
2. تُحفظ المقاطع الناجحة محلياً في IndexedDB لإعادة تشغيلها عند انقطاع الشبكة.
3. إذا فشل الطلب الشبكي، يُستخدم المقطع المحفوظ إن وُجد.
4. إذا لم يوجد اتصال أو مقطع محفوظ، يستخدم التطبيق Android Native TTS كخيار أخير.
5. السؤال يُنطق بالإنجليزية فقط قبل الإجابة. لا يظهر ولا يُنطق الشرح العربي قبل أن يختار الطفل إجابته ويتحقق منها.
6. بعد التحقق، تظهر تغذية راجعة وشرح عربي واحد، ويُقرأ الشرح بعد التغذية الراجعة.
7. حروف Phonics المنفردة لعلي تستخدم IPA phoneme synthesis بدلاً من اسم الحرف.
8. تُمنع أسماء الطفلين من الإرسال إلى مزوّد الصوت؛ النصوص الشخصية تبقى على الجهاز.

## إعداد Microsoft Azure AI Speech على Vercel

أنشئ مورداً من نوع **Speech** في Azure، ثم أضف متغيرين سريين إلى مشروع Vercel في بيئتي **Preview** و**Production**:

- `AZURE_SPEECH_KEY`: مفتاح مورد Speech.
- `AZURE_SPEECH_REGION`: معرّف المنطقة كما يظهر في Azure، مثل `uaenorth`.

لا تضع المفتاح في HTML أو GitHub أو APK، ولا ترسله في المحادثة. يجب أن يطابق الـregion المفتاح الخاص بالمورد؛ مفاتيح Azure Speech مرتبطة بالمنطقة.

الأصوات الافتراضية:
- English: `en-GB-SoniaNeural`.
- Arabic: `ar-EG-SalmaNeural`.
- خيارات إضافية متاحة في إعدادات الوالد.

الـendpoint يعيد MP3، ويدعم SSML وIPA، ويتعامل مع timeout و429 وRetry-After. يوجد حد وقائي محلي قدره 18 طلباً لكل عنوان IP خلال 60 ثانية لتقليل احتمال تجاوز حد Azure F0 البالغ 20 معاملة لكل 60 ثانية. هذا الحد الوقائي لا يحل محل حدود Azure الفعلية، ولا يضمن عدم وجود throttling على مستوى المورد.

بعد إضافة المتغيرات، أعد نشر Vercel Production. لا يُعد الصوت الشبكي جاهزاً حتى ينجح اختبار حقيقي للإنجليزية والعربية ويعيد HTTP 200 مع ملف صوتي غير فارغ.

## بناء APK

يُبنى APK من مجلد `android/` عبر GitHub Actions. الإصدار v1.3.0 يستخدم `versionCode 9` و`versionName 1.3.0`. في Pull Requests يُبنى APK تجريبي بتوقيع Debug، أما إصدار `main` فيُوقّع بمفتاح Release المحفوظ في GitHub Secrets، وتتحقق workflow من بصمة شهادة التوقيع قبل النشر.

لا ترفع ملف JKS أو كلمة مروره إلى المستودع.

## الخصوصية والاختبار

- لا توجد إعلانات أو أدوات تتبع أو إرسال لبيانات تقدم الطفل.
- مفاتيح Azure تبقى على الخادم في Vercel.
- اختبارات CI تحاكي مزوّد الصوت؛ لا تثبت وحدها نجاح الاتصال الحقيقي أو جودة النطق.
- لا يُدّعى اختبار جهاز Android فعلي إلا بعد تجربته على الجهاز.
- GitHub Pages يستضيف واجهة الويب فقط؛ خدمة TTS تعمل من Vercel.
