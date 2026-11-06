# Ali & Aboudy Scholars — v1.2.5

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

## نظام الصوت الهجين — أولوية الشبكة

1. عند توفر الإنترنت، يطلب التطبيق الصوت العصبي الشبكي أولاً لكل مقطع إنجليزي أو عربي؛ ولا يفضّل الكاش على الاتصال الشبكي.
2. تُحفظ المقاطع الناجحة في IndexedDB لإعادة استخدامها عند انقطاع الإنترنت.
3. عند تعذر الاتصال الشبكي، يستخدم التطبيق المقطع المحفوظ إن وُجد.
4. لا يُستخدم Android Native TextToSpeech أو Web Speech المحلي إلا إذا تعذر الصوت الشبكي ولم يوجد مقطع محفوظ، أو عند تفعيل اختبار الصوت المحلي يدوياً.
5. في شاشة السؤال، يُنطق نص السؤال الإنجليزي أولاً، ثم الشرح المساعد العربي كاملاً كما يظهر للطفل. وعند عرض حرف مستهدف منفرد لعلي، يُستبدل اسم الحرف بصوته التعليمي (Phonics).
6. اختبار الصوت الشبكي يرسل عينتين عامتين مستقلتين للإنجليزية والعربية ويتجاوز الكاش فعلياً. ويوجد اختبار منفصل للأصوات المحلية.
7. تُمنع أسماء الطفلين من الإرسال إلى الخدمة على مستوى التطبيق والخادم؛ النصوص الشخصية تبقى على الجهاز.

### إعداد Gemini TTS على Vercel

أضف المتغير السري `GEMINI_API_KEY` إلى مشروع Vercel في بيئتي Preview وProduction. لا تضع المفتاح في HTML أو GitHub أو APK. لا تستخدم `GOOGLE_TTS_API_KEY` لهذا المسار؛ فهو خاص بتكامل Google Cloud TTS القديم.

يستخدم endpoint موديل `gemini-3.8-flash-lite-tts` عبر Gemini Generate Content API، ويحوّل الصوت الناتج إلى WAV قبل إرساله للتطبيق. يجب أن يكون endpoint متاحاً من تطبيق الويب وAndroid؛ إذا كانت Vercel Deployment Protection/SSO تمنع الطلبات العامة، فلن يستطيع الهاتف الوصول إليه حتى لو كان المفتاح مضبوطاً.

الأصوات الافتراضية:
- English: `en-GB-Chirp3-HD-Aoede`
- Arabic: `ar-XA-Chirp3-HD-Aoede`

### تشخيص الصوت

- زر **Test English + Arabic** يجرب الشبكة مباشرة ويعرض هل نجح الاتصال أو رجع إلى الكاش/الصوت المحلي، مع رمز الخطأ عند الفشل.
- زر **Test local/offline voices** يتجاوز الشبكة والكاش ويختبر محرك Android/Web المحلي.
- لا يُعد وجود صوت عربي في القائمة دليلاً على تثبيت بياناته أو نجاح تشغيله؛ يجب تثبيت بيانات اللغة العربية من إعدادات Android وتجربة الزر المحلي على الهاتف.

## بناء APK

يُبنى APK من مجلد `android/` عبر GitHub Actions. الإصدار الحالي v1.2.5 يستخدم `versionCode 8`. في Pull Requests يُبنى APK تجريبي بتوقيع Debug للتحقق، أما الإصدار المنشور على `main` فيُوقّع بمفتاح Release المحفوظ في GitHub Secrets، وتتحقق workflow من بصمة شهادة التوقيع قبل النشر. لا ترفع ملف JKS أو كلمة مروره إلى المستودع.

## ملاحظات تشغيل

- GitHub Pages يستضيف واجهة الويب فقط؛ endpoint الصوت يحتاج نشر Vercel.
- إذا لم يتم إعداد `GOOGLE_TTS_API_KEY`، يستجيب endpoint برسالة غير مهيأ، ويستخدم التطبيق الصوت المحلي تلقائياً.
- لا تُعد جودة Android TTS أو العمل دون إنترنت مختبراً على جهاز فعلي إلا بعد إجراء الاختبار.
