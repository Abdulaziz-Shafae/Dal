# Dal | دال

المشروع مقسم إلى خدمتين داخل نفس المستودع:

| الخدمة | Root Directory | التشغيل |
| --- | --- | --- |
| Frontend — React + Vite | `/frontend` | Dockerfile يشغّل Node ويخدم الواجهة وAPI proxy |
| Backend — Spring Boot | `/backend` | Dockerfile يبني Maven ويشغّل Java 17 |

راجع [إعداد Railway](RAILWAY_SETUP.md). كل خدمة تُبنى من مجلدها دون الحاجة إلى ملفات الخدمة الثانية.
