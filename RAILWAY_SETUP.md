# تشغيل Dal على Railway

المستودع يحتوي Dockerfile لبناء Maven على Java 17 وتشغيل ملف JAR، وإعداد server.port=${PORT:8080}. لا تحتاج كتابة Build أو Start command إضافي عند استخدام Dockerfile الافتراضي. لم يتم نشر الخدمة فعليًا ضمن هذه المهمة.

1. أنشئ مشروع Railway وأضف MySQL.
2. أضف خدمة من GitHub repo Abdulaziz-Shafae/Dal، branch main، وRoot directory جذر المستودع.
3. أضف المتغيرات التالية في Variables لخدمة الباك إند. مثال اسم خدمة قاعدة البيانات MySQL؛ بدله بالاسم الفعلي إن كان مختلفًا:

```env
DB_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=lax
FRONTEND_ORIGINS=https://your-frontend-domain.example
```

DB_URL يجب أن يبدأ بـ jdbc:mysql://، وليس mysql://. FRONTEND_ORIGINS هو رابط الواجهة الفعلي بدون / في النهاية؛ يمكن فصل أكثر من رابط بفاصلة. لا تترك رابط المثال عند ربط الواجهة. إذا كانت الواجهة والباك إند cross-site استخدم SameSite=none مع Secure=true؛ راجع أثر third-party cookies، والأفضل وضعهما على نفس الموقع.

4. انشر الخدمة. من Settings/Networking أنشئ دومينًا عامًا. إعداد PORT يستخدم قيمة Railway تلقائيًا. إن ضبطت Target Port يدويًا، اجعله يطابق PORT الذي تعمل عليه الخدمة.
5. جرّب GET https://your-backend-domain.example/api/v1/security/csrf. الرد المتوقع JSON فيه token وheaderName. هذا مسار لتجربة الاتصال وليس healthcheck دوريًا.
6. أثناء انتظار Brevo يمكن ترك BREVO_API_KEY وPASSWORD_RESET_URL غير محددين؛ يبدأ التطبيق لكن لا يمكن إكمال استعادة الباسوورد عبر بريد حقيقي. أضف إعدادات البريد لاحقًا بعد تفعيل الحساب وصفحة الواجهة.

الواجهة تحتاج API base URL الخاص بالباك إند وcredentials: include، وتجلب CSRF قبل طلبات POST/PUT/DELETE. جاهزية نشر الباك إند لا تعني أن الواجهة مربوطة بالفعل. البوصلة والخريطة مؤجلتان حسب طلب المستخدم.

قاعدة البيانات تستخدم ddl-auto=update حاليًا لمسار التطوير؛ لا تستخدم قاعدة بيانات مشروع آخر. الجلسات في ذاكرة نسخة السيرفر الحالية: كل redeploy يبطلها، واستخدم نسخة backend واحدة حتى تضيف shared session store.

المراجع: https://docs.railway.com/builds/dockerfiles ، https://docs.railway.com/databases/mysql
