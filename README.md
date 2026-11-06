# Ali & Aboudy Scholars — v1.2.1

تطبيق تعليمي متكامل لعلي (KG2) وعبودي (Grade 2)، بملفي تعلم منفصلين ومحتوى تفاعلي متعدد المستويات.

## محتويات المشروع

- `index.html`: تطبيق الويب الأساسي، مع ملفات الطفلين وصورهما الأصلية بناءً على موافقة صاحب المشروع.
- `api/tts.js`: خادم وسيط آمن للصوت العصبي Google Cloud Text-to-Speech Chirp 3 HD.
- `tts-config.js`: إعداد مسار خدمة الصوت للويب.
- `android/`: غلاف Android WebView مع Android Native Text-to-Speech كخيار محلي.
- `.github/workflows/build-apk.yml`: فحص JavaScript وبناء APK آلياً ونشره كـ GitHub Release.
- `tts-config.android.js`: عنوان API الذي يحقن في نسخة Android.

## الميزات التعليمية

- ملفات منفصلة لعلي KG2 وعبودي Grade 2.
- الكتب والمناهج والدروس وPlay & Learn وDaily Challenge والمكافآت.
- My Learning World وSmart Learning Coach.
- Phonics Studio وJolly Phonics pathway وReading Adventure.
- Math Playground وLittle Science Lab وMy Word Collector.
- Adventure Arcade وSibling Team Quest وVirtual Pet وMystery Box وAchievement Vault.
- Parent Learning Report، النسخ الاحتياطي والاستعادة، وحفظ التقدم محلياً.
- واجهة مناسبة للهاتف والأجهزة اللوحية والكمبيوتر.

## نظام الصوت الهجين

1. تشغيل المقطع المحفوظ في IndexedDB أولاً.
2. عند عدم وجود نسخة محفوظة وتوفر الإنترنت، يطلب التطبيق صوتاً من Gemini 3.8 Flash-Lite TTS (`gemini-3.8-flash-lite-tts`) عبر خادم Vercel، ثم يحفظه محلياً.
3. عند انقطاع الإنترنت أو تعذر Gemini أو بلوغ الحصة، يرجع التطبيق تلقائياً إلى Android Native TTS أو Web Speech المحلي.
4. تخزين المقاطع حتى نحو 80 MB مع حذف الأقل استخداماً عند امتلاء المساحة.
5. يرسل التطبيق النص المطلوب نطقه فقط. وبموافقة الوالد، يمكن أن يتضمن النص الاسمين الأولين علي وعبودي لزيادة التفاعل؛ لا تُرسل ملفات الطفلين أو تقدمهما أو سجلات تعلمهما.
6. مفتاح Gemini يبقى في متغير بيئة Vercel ولا يدخل في HTML أو APK أو GitHub.

### تفعيل Gemini TTS دون Cloud Billing

أنشئ Gemini API key من [Google AI Studio](https://aistudio.google.com/apikey) مع استخدام مشروع Gemini Developer API على الخطة المجانية، دون تفعيل Google Cloud Billing. ثم أضف المتغير التالي في Vercel Project Settings → Environment Variables (Production وPreview):

`GEMINI_API_KEY` (Sensitive)

لا تضع المفتاح في HTML أو GitHub أو APK. النموذج الافتراضي هو `gemini-3.8-flash-lite-tts`؛ والأصوات الافتراضية Puck للإنجليزية وKore للعربية. يمكن تغيير الصوت من إعدادات الوالد. معدل التشغيل المحلي للصوت المحفوظ قابل للضبط، ويُحفظ كل معدل كنسخة Cache مستقلة.

الخطة المجانية لها حدود استخدام متغيرة حسب النموذج والمشروع؛ راجع حدود المشروع في AI Studio. قد تستخدم Google مدخلات Free Tier لتحسين منتجاتها، لذلك لا يرسل التطبيق أي معلومات تعلم أو ملفات شخصية.

## بناء APK

يُبنى APK من مجلد `android/` عبر GitHub Actions. البناء الحالي يستخدم debug signing لتوفير APK قابل للتثبيت دون نشر أو كشف مفتاح التوقيع الخاص. لذلك لا يمكن تثبيته كتحديث فوق نسخة موقعة بمفتاح مختلف؛ صدّر بيانات التعلم من النسخة القديمة أولاً، ثم أزلها وثبّت APK الجديد، وبعدها استورد النسخة الاحتياطية.

لإصدار تحديث يحافظ على إمكانية التثبيت فوق APK سابق، يجب توقيع البناء بالمفتاح الأصلي المطابق. لا ترفع ملف JKS أو كلمة مروره إلى المستودع.

## ملاحظات تشغيل

- GitHub Pages يستضيف واجهة الويب فقط؛ endpoint الصوت يحتاج نشر Vercel.
- إذا لم يتم إعداد `GEMINI_API_KEY`، يستجيب endpoint برسالة غير مهيأ، ويستخدم التطبيق الصوت المحلي تلقائياً.
- لا تُعد جودة Android TTS أو العمل دون إنترنت مختبراً على جهاز فعلي إلا بعد إجراء الاختبار.
