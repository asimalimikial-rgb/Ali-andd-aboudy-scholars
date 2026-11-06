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

1. تشغيل المقطع المحفوظ في IndexedDB إذا سبق توليده.
2. إذا لم يكن محفوظاً وكان الإنترنت متاحاً، طلب MP3 من Chirp 3 HD ثم حفظه محلياً.
3. عند عدم الاتصال وعدم وجود نسخة محفوظة، الرجوع إلى Android Native TTS أو Web Speech المحلي.
4. تخزين المقاطع حتى نحو 80 MB مع حذف الأقدم عند الحاجة.
5. لا يرسل التطبيق اسم الطفل أو ملفه أو تقدمه إلى خدمة الصوت؛ يتم إرسال النص المطلوب نطقه والـ voice ID فقط. النصوص التي تحتوي أسماء الطفلين تُحوّل إلى الصوت المحلي ولا تُرسل للخدمة.

### تفعيل Google Cloud TTS

تتطلب Google تفعيل Billing وربط حساب فوترة حتى عند استخدام الحصة المجانية. الحصة المجانية المعلنة لـ Chirp 3 HD هي حتى مليون حرف شهرياً؛ لا يُفترض أن الخدمة بلا شروط فوترة. راقب الاستهلاك وحدود المشروع في Google Cloud Console.\n

أنشئ Google Cloud API key مقيّداً بخدمة Cloud Text-to-Speech، وفعّل Cloud Text-to-Speech في المشروع. ثم أضف المتغير التالي في Vercel Project Settings → Environment Variables:

`GOOGLE_TTS_API_KEY` (Sensitive)

لا تضع المفتاح في HTML أو GitHub أو APK. يدعم Chirp 3 HD التحكم في وتيرة النطق (Pace) عبر speakingRate؛ يحفظ التطبيق كل سرعة كمقطع منفصل حتى لا يُعاد استخدام ملف صوت بسرعة مختلفة. واجهة التحكم هنا محدودة بين 0.75 و1.25 لتناسب الأطفال.

الأصوات الافتراضية:
- English: `en-GB-Chirp3-HD-Aoede`
- Arabic: `ar-XA-Chirp3-HD-Aoede`

يمكن اختيار أصوات أخرى من الإعدادات.

## بناء APK

يُبنى APK من مجلد `android/` عبر GitHub Actions. البناء الحالي يستخدم debug signing لتوفير APK قابل للتثبيت دون نشر أو كشف مفتاح التوقيع الخاص. لذلك لا يمكن تثبيته كتحديث فوق نسخة موقعة بمفتاح مختلف؛ صدّر بيانات التعلم من النسخة القديمة أولاً، ثم أزلها وثبّت APK الجديد، وبعدها استورد النسخة الاحتياطية.

لإصدار تحديث يحافظ على إمكانية التثبيت فوق APK سابق، يجب توقيع البناء بالمفتاح الأصلي المطابق. لا ترفع ملف JKS أو كلمة مروره إلى المستودع.

## ملاحظات تشغيل

- GitHub Pages يستضيف واجهة الويب فقط؛ endpoint الصوت يحتاج نشر Vercel.
- إذا لم يتم إعداد `GOOGLE_TTS_API_KEY`، يستجيب endpoint برسالة غير مهيأ، ويستخدم التطبيق الصوت المحلي تلقائياً.
- لا تُعد جودة Android TTS أو العمل دون إنترنت مختبراً على جهاز فعلي إلا بعد إجراء الاختبار.
