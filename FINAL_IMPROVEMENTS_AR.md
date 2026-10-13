# دال — التحسينات النهائية وAI والتوجيه بالمشي

13 أكتوبر 2026. خط الأساس `d593f02`. هذا تقرير التحقق قبل الرفع المعتمد إلى main؛ أكد المالك توقف Auto Deploy. لم يُنفذ Deployment أو أي إجراء في Railway.

## الوظائف المكتملة

| الوظيفة | التنفيذ |
|---|---|
| تفعيل الملاحة | زر «تفعيل الملاحة» يفعّل موافقة دال ويطلب الحساس من تفاعل المستخدم، وGPS وفق إعدادات المشاركة. حالة الحساس في App؛ الانتقال بين الخريطة والبوصلة لا يعيد إنشاء حالة الإذن |
| رفض الأذونات والعودة للتطبيق | مراقبة إذن الموقع عبر Permissions API عند دعمه؛ سحب الإذن يزيل الموقع ويوقف الموافقة المحلية. رفض الحساس أو غياب قراءته يعرض حالة واضحة وإعادة تفعيل. موافقة الذاكرة ليست إثباتًا لإذن النظام |
| البوصلة | الحسابات الحالية محفوظة؛ يظهر السهم مع موقع ووجهة صالحين، حتى دون حساس، مع عبارة الاتجاه بالنسبة للشمال. قراءة الحساس الفعلية تستبدل الاتجاه النسبي عند توفرها |
| Walking Navigation | Marker العضو أو نقطة اللقاء يبدأ معاينة طريق مشي من موقع Backend الحديث إلى الوجهة المصرح بها. أزرار البدء والإيقاف و«وجّهني» مرتبطة بالطريق، وزر مستقل يفتح البوصلة |
| طريق المشي وملخصه | Leaflet Polyline بلون دال؛ المسافة بالمتر ومدة المشي من نتيجة Routing فقط. المسافة المباشرة في بطاقة العضو وPopup موسومة بوضوح |
| تحديث الطريق | Debounce بمقدار 800ms، فاصل 10 ثوانٍ بين الطلبات، حركة مؤثرة 25 مترًا، وتجديد بعد 30 ثانية. تغيير الوجهة يلغي قبول النتيجة القديمة؛ لا تتداخل الطلبات |
| رفض المشاركة وقدم الموقع | Backend يتحقق من عضوية المستخدم والوجهة وإعدادات المشاركة قبل الحساب وبعده. أصل الطريق يحتاج موقعًا بعمر 60 ثانية أو أقل؛ موقع العضو بعمر خمس دقائق أو أكثر لا يُوجّه إليه. بعد 30 ثانية يظهر تحذير آخر موقع معروف |
| تعذر Routing | لا تُعرض مسافة طريق أو مدة وصول مخترعة. عند فشل الخدمة يمكن عرض خط متقطع موسوم «اتجاه مباشر، وليس طريق مشي». سحب المشاركة يستخدم حالة مختلفة تمنع حتى هذا البديل |
| AI Reunion Assistant | «ساعدني أوصل» في الخريطة والبوصلة. قرار وتوصية وحالة حداثة ودقة محسوبة في Backend، وOpenAI يشرحها بالعربية بمخرجات منظمة. يستخدم مسافة طريق محفوظ وحديث عند توفره، ولا ينشئ طلب ORS ضمن طلب AI |
| AI Meeting Point | المسؤول يحدد حتى ثلاثة مرشحين ويسميهم؛ تُستبعد المواقع غير المسموحة والقديمة والدقة غير الكافية. ترتيب المرشحين يقلل أكبر مسافة مباشرة لعضو. AI يشرح الترتيب والتحفظات، وتُعرض النقطة المقترحة بلون مختلف |
| نقطة اللقاء الحالية | تُستخدم في سياق AI كمسافة مباشرة محسوبة ووجود نقطة حالية فقط، دون أسماء أو إحداثيات. لا تُدرج تلقائيًا كمرشح ولا تتغير دون زر اعتماد المسؤول |
| غياب AI | `source=RULES` ونص صريح بأن الخدمة غير متاحة؛ التوصيات الحسابية لا تُعرض كأنها استجابة AI. المهلة والخطأ ورفض المخرجات غير الصالحة يعود إلى البديل الحسابي |
| عداد التنبيهات | Backend يعد كل السجلات غير المقروءة، وليس أول صفحة. Badge يعرض 1 و3 وحتى 99+ ويختفي عند الصفر. تحديث كل 10 ثوانٍ أثناء ظهور التطبيق، وبعد تعليم تنبيه كمقروء؛ تحميل القائمة وحده لا ينقص العدد |
| المحادثة الجماعية | تبويب مستقل مع اسم المرسل والوقت وتمييز المستخدم وPagination وتحديث دوري. مفتاح إرسال ثابت عند إعادة المحاولة وUnique Constraint يمنعان التكرار. إشعار بقية الأعضاء وقراءة مستقلة لكل عضو |
| المحادثات الخاصة | محفوظة في تبويب مستقل وبـ Entity وEndpoints الحاليين. قراءة الجماعي لا تعلم الخاص كمقروء. تبويبا المحادثة داخل الحاوية حتى يبقى حقل الإرسال ظاهرًا على الجوال |
| آخر تحديث للموقع | الاسترجاع الحالي من آخر `recordedAt` محفوظ؛ عرض العمر بالدقائق بدل وصفه بآخر ظهور. لا يُنشأ موقع عند غياب GPS، ويُحترم إيقاف المشاركة وحذف التاريخ |
| الصفحة الرئيسية | Login واستعادة الجلسة والرئيسية والشعار للمستخدم المسجل تؤدي إلى مجموعاتي. Logout يعود إلى Landing Page. روابط الدعوة والاستعادة تحتفظ بوجهتها |
| الفوتر وصورة الجوال | رابطا الخريطة والبوصلة مستقلان، وإزالة تكرار عنوان المجموعات. نسبة الصورة تلقائية ومطابقة لقناعها عند ضيق العمود؛ الظل على الحاوية خارج القناع، وميل خفيف دون إعادة تصميم الرئيسية |

## Endpoints الجديدة

كلها تحت `/api/v1`، وتستخدم HttpSession الحالية؛ عمليات POST وPUT تستخدم CSRF الحالي. لم تتغير إعدادات Authentication أو CORS أو CSRF.

| Method | المسار | الغرض |
|---|---|---|
| POST | `/navigation/group/{groupId}/walking` | طريق مشي إلى `{memberId, meetingPoint}`؛ إحداثيات المصدر والعضو تُقرأ من Backend، لا من مدخل React |
| POST | `/navigation/group/{groupId}/reunion-assistance` | شرح لمّ الشمل إلى الوجهة نفسها |
| POST | `/navigation/group/{groupId}/meeting-suggestions` | مقارنة قائمة `candidates` المصرح بها للمسؤول |
| GET | `/notification/unread-count` | العدد الكامل غير المقروء للمستخدم الحالي |
| POST | `/group-message/group/{groupId}` | إرسال `{content, clientMessageId}` |
| GET | `/group-message/group/{groupId}?page=0&size=20` | رسائل المجموعة مع `senderName` |
| PUT | `/group-message/group/{groupId}/read/{messageId}` | إقرار قراءة رسائل المجموعة حتى الرسالة المحددة للمستخدم الحالي |
| GET | `/group-message/group/{groupId}/unread-count` | غير المقروء في هذه المجموعة لهذا العضو |

إقرار قراءة الجماعي منفصل عن قراءة التنبيهات والرسائل الخاصة. Badge ينقص عند قراءة سجل التنبيه صراحة.

## Database Migration

ملف [Migration](backend/migrations/20261013_group_conversation.sql) يضيف فقط `group_messages` و`group_message_reads` مع Foreign Keys والفهارس ومنع تكرار الإرسال. اختُبر على Oracle MySQL 8.4.11 محلية منفصلة، دون الاتصال بقاعدة الإنتاج أو خدمة قاعدة البيانات الموجودة على الجهاز.

إعداد `ddl-auto=update` الحالي لم يتغير. المسار الموافق له هو ترك Hibernate ينشئ الجدولين المفقودين عند نشر المالك، **دون تنفيذ SQL يدويًا**. اختُبر أيضًا مسار SQL مرة واحدة قبل التشغيل ثم update: ظلت الأعمدة والفهارس والمفاتيح الأجنبية ثابتة عند التشغيل وإعادة التشغيل، ونجح validate. ملف SQL خارج الموارد التلقائية ولا يُنفذ تلقائيًا. راجع [طريقة الإنشاء ومنع التنفيذ المزدوج](backend/migrations/README.md).

نجح إرسال العربية واسترجاعها للأعضاء الثلاثة، ومنع التكرار، وقراءة مستقلة لكل عضو، ورفض العضو الخارجي، والقيود Unique وForeign Keys داخل MySQL نفسها. حُفظت الرسائل ومؤشرات القراءة بعد إعادة التشغيل، وبقيت الرسائل الخاصة ونقطة اللقاء والموقع الاصطناعي سليمة. نسخة الإنتاج ومخططها لم تُفحص؛ يراجعهما المالك قبل النشر. أُوقفت نسخة MySQL المؤقتة ونُظفت ملفاتها بعد الاختبار.

## إعداد الخدمات — خطوات ينفذها مالك المشروع

لم يُفتح Railway ولم تتغير Variables أو إعدادات الخدمات خلال المهمة. بعد الموافقة على الكود، أضف في **خدمة Backend** عبر Variables:

| Variable | الاستخدام |
|---|---|
| `OPENROUTESERVICE_API_KEY` | مفتاح ORS من حسابك؛ Backend فقط |
| `OPENAI_API_KEY` | مفتاح مشروع OpenAI؛ Backend فقط |
| `OPENAI_MODEL` | اختياري؛ الافتراضي `gpt-4.1-mini`، ويمكن اختيار نموذج يدعم Responses وStructured Outputs ومتاح لمشروعك |

لا تضع المفاتيح في React أو متغيرات `VITE_` أو ملفات Git أو التقرير. توليد المفاتيح ومراجعة الميزانية والحصص والنشر مسؤولية المالك. بدون المفاتيح يظل التطبيق يعمل بالبدائل الواضحة.

تكامل OpenAI يستخدم `/v1/responses` مع JSON Schema و`store:false` وحد أقصى 400 token. لا يرسل أسماء أو IDs أو إحداثيات أو رسائل المحادثة؛ يرسل مسافات وأعمار تحديث ودقة وحالات مشتقة فقط. مهلة الاتصال 1.5 ثانية والقراءة 4.5 ثانية، وحد محلي 10 طلبات AI في الدقيقة لكل نسخة Backend. القرار الحسابي والنقطة المختارة لا يغيرهما النموذج. توجد فلترة تحفظية لبعض ادعاءات السلامة والزحام؛ لا تمثل ضمانًا كاملًا لصحة كل شرح مولّد. راجع [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) و[النموذج](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

`store:false` ليس Zero Data Retention، وقد تطبق سجلات المراقبة وسياسات الاحتفاظ الخاصة بحساب الخدمة. راجع [ضوابط بيانات OpenAI](https://developers.openai.com/api/docs/guides/your-data) قبل تشغيل الخدمة بمستخدمين حقيقيين.

## Routing: الحدود والترخيص والخصوصية

استخدمنا `POST /v2/directions/foot-walking/geojson`؛ الإحداثيات إلى ORS بترتيب longitude ثم latitude، والنتيجة إلى Leaflet بترتيب latitude ثم longitude. مهلة الاتصال 1.5 ثانية والقراءة 4.5 ثانية، Cache صالح 30 ثانية في الذاكرة فقط وبحد 128 نتيجة، ومنع الطلب المتزامن للمسار نفسه. لا تُسجّل الإحداثيات أو محتوى أخطاء المزود في Service.

راجعت [الخطة الرسمية](https://account.heigit.org/info/plans) ونصها العام المنشور عبر JavaScript: Standard تعرض 2,000 طلب Directions يوميًا و40 في الدقيقة وقت المراجعة. الحد داخل الكود أقل: 1,500 يوميًا و30 في الدقيقة لكل نسخة Backend. هذه الحدود ليست مشتركة بين نسخ متعددة، وتُصفّر عند إعادة التشغيل؛ راجع حصة المفتاح الفعلية في حسابك وتعامل مع اختلافها أو نفادها. فشل المزود أو 429 لا ينتج مسافة أو مدة وهمية. [قيود API](https://openrouteservice.org/restrictions/).

[شروط HeiGIT/ORS](https://account.heigit.org/info/tos) تشترط الإسناد، ونتائج ORS مرخصة CC BY-SA 4.0. تظهر روابط الإسناد والترخيص مع التوجيه. OSM له إسناده الحالي. يلزم مراعاة الترخيص عند إعادة توزيع نتائج الطرق؛ هذه ليست إعادة ترخيص لكود دال كله.

طلب الطريق يحتاج إرسال إحداثيات الأصل والوجهة المصرح بها إلى ORS؛ لذلك توضّح واجهة تفعيل الملاحة هذا النقل. لا ترسل الأسماء أو هوية العضو للمزود. [سياسة HeiGIT](https://heigit.org/privacy-policy/) تشمل معالجة معرفات الاتصال والخدمات؛ لا ندعي حذف بيانات المزود فورًا أو أن النقل عبر Backend يجعل الإحداثيات غير شخصية.

الخريطة الخارجية قد لا تشمل ممرات إكسبو الداخلية أو الإغلاقات الحالية أو الزحام أو متطلبات الوصول. الطريق والمدة بيانات شبكة المشاة المتاحة، ولا يثبتان سلامة المرور أو إمكانية الوصول. البوصلة والبديل المتقطع اتجاه مباشر، وليس طريق مشي.

## نتائج الاختبارات

| الفحص | النتيجة |
|---|---|
| `npm test` | 35/35 ناجحة، صفر فشل أو تجاوز |
| `npm run build` | ناجح، 1689 module |
| Backend `mvnw package` | 46/46 اختبارًا ناجحًا، صفر فشل أو أخطاء أو تجاوز، وبناء JAR ناجح |
| Migration على MySQL 8.4.11 | SQL ثم update، وupdate وحده، وإعادة التشغيل وvalidate وJPA والقيود: ناجحة |
| اختبار المتصفح للميزات الجديدة | 19 تحققًا ناجحًا، صفر Page Errors |
| اختبار الملاحة السابق | 8 سيناريوهات ناجحة، صفر Page Errors |
| العروض | 360 و390 و430 و768 و1440؛ صفر خروج أفقي، وفحص حقل المحادثة فوق شريط التنقل |
| `git diff --check` | ناجح |

اختبارات Backend: 45 اختبارًا مع H2 وخوادم محلية، واختبار تكامل إضافي على MySQL حقيقية معزولة يشغّل سبعة سياقات JPA/Hibernate. الحسابات والرسائل والمواقع اصطناعية فقط. إعدادات `IsolatedDalContext` تثبت H2 وتعطّل مفاتيح المزودين والبريد؛ اختبار MySQL يثبت عنوانًا محليًا وقاعدة فارغة محددة ويعطّل الخدمات الخارجية. لا تُستخدم حسابات إنتاج أو مفاتيح فعلية. اختبار MySQL اختياري في التشغيل الاعتيادي، وشُغّل صراحةً في هذا التحقق النهائي.

اختُبرت الصلاحيات وCSRF، DTO اسم المرسل لثلاث جلسات HTTP، التكرار، الفصل بين قراءة الجماعي والخاص، عدد 105 إشعارات وعدم نقصه بمجرد تحميل الصفحة، آخر موقع واسترجاعه وحذفه داخل H2، حالات البيانات المفقودة والقديمة، سياق نقطة اللقاء الحالية، استبعاد غير المشاركين أو غير المؤهلين، وعدم الحفظ التلقائي.

اختُبرت مهلة المزود فعليًا بخادم محلي بطيء، وغياب المفتاح، وفشل الاتصال، ومخرجات AI غير الصالحة، وCache، وتحويل GeoJSON، وسحب المشاركة أثناء انتظار الطريق. اختُبر أن مسافة طريق محفوظة تدخل مساعد AI دون أسماء أو إحداثيات أو طلب ORS إضافي.

المتصفح Edge على Windows، مع GPS وحساس وAPI وTiles اصطناعية. اختُبر Marker عضو ونقطة لقاء وتغيير وجهة وتحرك المستخدم، إيقاف/بدء التوجيه، عطل Routing والبديل الموسوم، قدم الموقع، سحب المشاركة، مرشحات المسؤول واعتماده الصريح، الجماعي والخاص، الأذونات أثناء التنقل، Badge، Login واستعادة الجلسة وLogout والدعوة والاستعادة. أحداث Marker في الفحص اصطناعية؛ الأزرار والنماذج تستخدم تفاعلات المتصفح.

## المقارنة البصرية

تمت مراجعة `AGENTS.md` ودليل التحدي ومرجع `DAL.pdf`. التحسينات هنا متطلبات المستخدم، وليست متطلبات جديدة اخترعناها للدليل. لا يوجد ملف Figma متاح محليًا؛ حافظنا على هوية النسخة الحالية وقارنّا صورة الجوال بصفحة 41 ومراجع الجوال. لا ندعي Pixel-Perfect أو تطابقًا كاملًا مع مصدر Figma.

عند تضييق عمود الصورة كان الارتفاع الثابت يجعل مساحة العنصر وقناع CSS لا يتبعان النسبة نفسها. أصبح الارتفاع تلقائيًا وفق 820/1360، مع ظل على الحاوية خارج القناع وميل -1°، وأُبقيت خلفية الجوال المرجعية الحالية دون إعادة تصميم الرئيسية. صور «قبل» من اللقطات المعتمدة للمراجعة السابقة، و«بعد» من Build الحالي.

| الحالة | قبل | بعد |
|---|---|---|
| Desktop 1440 | [قبل](docs/qa/landing-before-1440.jpg) | [بعد](docs/qa/landing-after-1440.jpg) |
| Tablet 768 | [قبل](docs/qa/landing-before-768.jpg) | [بعد](docs/qa/landing-after-768.jpg) |

شاشات جديدة ببيانات اختبار: [التوجيه](docs/qa/walking-member.jpg)، [اقتراح النقطة](docs/qa/meeting-suggestion.jpg)، [المحادثة الجماعية](docs/qa/group-chat.jpg). سبع صور مختارة فقط، نحو 1.25 MiB؛ بقية QA محفوظة محليًا ومستبعدة من Git. الصور الكاملة قد تُظهر شريط التنقل الثابت داخل امتداد الصفحة؛ موضعه الفعلي مرتبط بالـ Viewport.

## طريقة الاختبار بعد الإعداد

1. استخدم نسخة اختبار وقاعدة منفصلة، مع ثلاثة أعضاء في مجموعة وحساب رابع خارجها؛ لا تختبر إجراءات الكتابة على مستخدمين حقيقيين.
2. افتح HTTPS على جوالين، فعّل الملاحة من الزر، واسمح بالموقع والحساس إن طلبهما المتصفح. انتقل بين الخريطة والبوصلة ثم عد للتطبيق؛ اسحب الإذن من إعدادات الجهاز وجرّب إعادة التفعيل.
3. اختر Marker العضو ونقطة اللقاء، وابدأ/أوقف التوجيه، وتحرك أكثر من 25 مترًا، ثم غيّر الوجهة. تحقق من الطريق والمسافة والمدة؛ أوقف مشاركة العضو وتأكد من اختفاء الطريق.
4. بعد طريق محسوب حديثًا اضغط «ساعدني أوصل». وجود `source=OPENAI` يثبت أن الشرح عاد من الخدمة؛ وجود `RULES` بديل حسابي واضح. جرّب غياب الموقع وقدمه وضعف دقته وغياب المفتاح أو عطل الخدمة في بيئة الاختبار.
5. كمسؤول، حدّد نقطتين أو ثلاثًا موثوقتين على الخريطة وسمّها، ثم اطلب الاقتراح. تحقق من الترتيب والتحفظات واللون؛ لا تتغير نقطة اللقاء إلا بعد زر الاعتماد.
6. أرسل رسالة جماعية وشاهد اسم المرسل لدى الأعضاء الثلاثة، واختبر الخاص منفصلًا. الحساب الخارجي يجب أن يُرفض. تحقق من Badge قبل وبعد تعليم سجل التنبيه كمقروء.

## القيود والمشاكل المتبقية

- الخدمات الحقيقية OpenAI وORS لم تُستدعَ بمفاتيح فعلية في هذه المهمة. تم اختبار البروتوكول والمهلات والأخطاء عبر خوادم محلية؛ نجاح بيانات الاختبار ليس دليل استجابة AI أو طريق فعلي من المزود.
- iPhone/Safari وAndroid والحساس الفعلي وGPS الميداني ولوحة مفاتيح الجوال: **Not Tested**. التنفيذ جاهز للاختبار على جوالين عبر HTTPS بعد إعداد نسخة الاختبار والخدمات، وليس شهادة جاهزية ميدانية.
- ترتيب نقاط اللقاء يستخدم المسافة المباشرة فقط، موسومة بوضوح؛ لا ينشئ Matrix مشاة لكل الأعضاء. مسافة المشي الحقيقية تستخدم في مساعد لمّ الشمل عند وجود نتيجة محفوظة.
- قد يعيد المتصفح طلب إذن الموقع أو الحساس؛ لا يستطيع التطبيق ضمان منعه. حالة الحساس في ذاكرة React فقط، والإذن يُراجع بالقراءات الفعلية أو Permissions API عند دعمها.
- Cache والحصص محلية لكل نسخة Backend ولا تستمر عبر إعادة التشغيل. لا يوجد SLA لمزود مجاني، ولا تشغيل GPS موثوق في خلفية متصفح الجوال، ولا Route داخلي مخصص لإكسبو.
- Migration اختُبرت على MySQL 8.4.11 منفصلة ولم تُطبّق على الإنتاج. إعداداتها الحالية لم تتغير. يلزم مالك المشروع مراجعة نسخة الإنتاج ومخططها وإعداد المفاتيح واختبار النسخة المنشورة.
- لا توجد مشكلة فشل اختبارات معروفة في النسخة المحلية النهائية، ولا ادعاء بتطابق Figma الكامل أو خلو النص المولّد من كل خطأ محتمل.

## الملفات الجديدة والمعدلة

ترد قائمة الملفات الـ56 أدناه: الملفات الـ54 المعتمدة، مع اختبار MySQL وتوثيق طريقة إنشاء الجداول فقط. لا توجد تغييرات في إعدادات الأمان أو إعدادات Railway أو Dependencies أو Docker أو ملفات المصادر المتزامنة.

| الملف | الحالة |
|---|---|
| .gitignore | معدل |
| backend/migrations/20261013_group_conversation.sql | جديد |
| backend/migrations/README.md | جديد |
| backend/src/main/java/com/example/dal/Controller/GroupMessageController.java | جديد |
| backend/src/main/java/com/example/dal/Controller/NavigationAssistanceController.java | جديد |
| backend/src/main/java/com/example/dal/Controller/NotificationController.java | معدل |
| backend/src/main/java/com/example/dal/DtoIn/NavigationRequest.java | جديد |
| backend/src/main/java/com/example/dal/DtoOut/NavigationResult.java | جديد |
| backend/src/main/java/com/example/dal/Model/GroupMessage.java | جديد |
| backend/src/main/java/com/example/dal/Model/GroupMessageRead.java | جديد |
| backend/src/main/java/com/example/dal/Repository/GroupMessageReadRepository.java | جديد |
| backend/src/main/java/com/example/dal/Repository/GroupMessageRepository.java | جديد |
| backend/src/main/java/com/example/dal/Repository/NotificationRepository.java | معدل |
| backend/src/main/java/com/example/dal/Service/AiExplanationService.java | جديد |
| backend/src/main/java/com/example/dal/Service/GroupMessageService.java | جديد |
| backend/src/main/java/com/example/dal/Service/NavigationAssistanceService.java | جديد |
| backend/src/main/java/com/example/dal/Service/NotificationService.java | معدل |
| backend/src/main/java/com/example/dal/Service/WalkingRoutingService.java | جديد |
| backend/src/test/java/com/example/dal/ControllerWorkflowTests.java | معدل |
| backend/src/test/java/com/example/dal/DalApplicationTests.java | معدل |
| backend/src/test/java/com/example/dal/FinalFeaturesWorkflowTests.java | جديد |
| backend/src/test/java/com/example/dal/IsolatedDalContext.java | جديد |
| backend/src/test/java/com/example/dal/MySqlMigrationCompatibilityTests.java | جديد |
| backend/src/test/java/com/example/dal/SecurityWorkflowTests.java | معدل |
| backend/src/test/java/com/example/dal/Service/ExternalNavigationTests.java | جديد |
| backend/src/test/java/com/example/dal/Service/NavigationPermissionTests.java | جديد |
| backend/src/test/java/com/example/dal/ServiceWorkflowTests.java | معدل |
| backend/src/test/resources/application.properties | معدل |
| docs/final-validation.json | جديد |
| docs/qa/group-chat.jpg | جديد |
| docs/qa/landing-after-1440.jpg | جديد |
| docs/qa/landing-after-768.jpg | جديد |
| docs/qa/landing-before-1440.jpg | جديد |
| docs/qa/landing-before-768.jpg | جديد |
| docs/qa/meeting-suggestion.jpg | جديد |
| docs/qa/walking-member.jpg | جديد |
| FINAL_IMPROVEMENTS_AR.md | جديد |
| frontend/src/api.js | معدل |
| frontend/src/components/GroupChat.jsx | جديد |
| frontend/src/components/navigation/GroupNavigation.jsx | معدل |
| frontend/src/components/navigation/LiveCompass.jsx | معدل |
| frontend/src/components/navigation/LiveMap.jsx | معدل |
| frontend/src/components/navigation/MeetingSuggestions.jsx | جديد |
| frontend/src/components/navigation/ReunionAssistant.jsx | جديد |
| frontend/src/components/NotificationBadge.jsx | جديد |
| frontend/src/design-refinements.css | معدل |
| frontend/src/hooks/useDeviceOrientation.js | معدل |
| frontend/src/hooks/useGeolocation.js | معدل |
| frontend/src/hooks/useGroupLocations.js | معدل |
| frontend/src/hooks/useWalkingRoute.js | جديد |
| frontend/src/main.jsx | معدل |
| frontend/src/utils.js | معدل |
| frontend/src/utils/navigationCalculations.js | معدل |
| frontend/tests/final-features-browser.mjs | جديد |
| frontend/tests/final-features.test.mjs | جديد |
| frontend/tests/navigation-browser.mjs | معدل |

[سجل التحقق المختصر](docs/final-validation.json).
