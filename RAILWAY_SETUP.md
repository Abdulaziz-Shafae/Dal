# تشغيل Dal على Railway

أنشئ مشروعًا يحتوي MySQL وخدمتين من مستودع `Abdulaziz-Shafae/Dal` وفرع `main`.

## 1. Backend

من Settings → Source اضبط Root Directory على `/backend`. استخدم Dockerfile داخل هذا المجلد، واترك Build وStart commands فارغة.

أضف Variables التالية، مع تعديل اسم MySQL إن اختلف:

```env
DB_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=lax
FRONTEND_ORIGINS=https://YOUR-FRONTEND.up.railway.app
```

انشر الخدمة وأنشئ Public Domain من Settings → Networking. يستخدم التطبيق PORT تلقائيًا؛ Target Port يجب أن يطابقه. لا تستخدم قاعدة بيانات مشروع آخر.

## 2. Frontend

أضف خدمة أخرى من المستودع نفسه، واضبط Root Directory على `/frontend`. تستخدم Dockerfile الخاص بها؛ لا تحتاج Build أو Start commands إضافية.

أضف المتغير التالي بعد نشر الباك إند:

```env
BACKEND_URL=https://YOUR-BACKEND.up.railway.app
```

اترك VITE_API_BASE_URL غير محدد. الواجهة تطلب `/api/v1` من نفس رابطها، وNode يحول الطلبات إلى الباك إند مع كوكي الجلسة وCSRF. BACKEND_URL متغير تشغيل للواجهة، دون `/api/v1` في نهايته. لا تضع مفاتيح Brevo في خدمة الواجهة.

انشر الواجهة وأنشئ Public Domain ثم حدّث FRONTEND_ORIGINS في خدمة Backend إلى رابط الواجهة الحقيقي، دون `/` في النهاية. لا تضبط Domain لكوكي الجلسة؛ تستخدم الواجهة proxy من نفس الأصل، لذلك SameSite=lax مناسب لهذا المسار.

## 3. Brevo لاحقًا

في Backend فقط، بعد تفعيل Brevo:

```env
BREVO_API_KEY=YOUR_KEY
BREVO_SENDER_EMAIL=dal.support.sa@gmail.com
BREVO_SENDER_NAME=Dal
PASSWORD_RESET_URL=https://YOUR-FRONTEND.up.railway.app/reset-password
```

يمكن تشغيل الخدمات قبل تفعيل البريد؛ استعادة الباسوورد عبر البريد تنتظر التفعيل. الخريطة والبوصلة مؤجلتان.

## التحقق

افتح رابط الواجهة وسجل حسابًا ثم سجل الدخول. جرّب GET `/api/v1/security/csrf` على رابط الواجهة؛ يجب أن يرجع token وheaderName من الباك إند. هذا ليس healthcheck دوريًا.

الجلسات حاليًا في ذاكرة نسخة Backend واحدة؛ إعادة النشر تُبطلها. قاعدة البيانات تستخدم ddl-auto=update لمرحلة التطوير.

## التشغيل المحلي

Backend: داخل backend شغّل `bash mvnw spring-boot:run` مع متغيرات MySQL.
Frontend: داخل frontend شغّل `npm ci` ثم `npm run dev`؛ Vite يحوّل /api إلى localhost:8080. يمكن تغيير API_PROXY_TARGET محليًا.
