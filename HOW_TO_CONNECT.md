# 🗄 طريقة ربط db.js بجميع الصفحات

## الملفات المطلوبة
| الملف | الوظيفة |
|-------|---------|
| `db.js` | النظام الرئيسي لإدارة الحسابات والبيانات |
| `auth-guard.js` | حماية الصفحات — يُعيد التوجيه للدخول إذا لم يُسجَّل |

---

## 1. صفحة تسجيل الدخول (logIn.html)
```html
<script src="db.js"></script>
<!-- DB.login(email, password) → { success, uid, user, error } -->
```

## 2. صفحة إنشاء الحساب (register.html)
```html
<script src="db.js"></script>
<!-- DB.register({ name, email, password, phone, birthdate, city, avatar }) -->
```

## 3. الصفحات المحمية (home, profile, team-tasks, chatbot)
```html
<!-- ضع هذا في <head> أو أول <script> -->
<script src="db.js"></script>
<script src="auth-guard.js"></script>
```

---

## 4. استبدال localStorage في home.js

```js
// قبل (قديم)
let tasks = JSON.parse(localStorage.getItem('tasks_v3') || '[]');
function save() { localStorage.setItem('tasks_v3', JSON.stringify(tasks)); }

// بعد (مع db.js)
let tasks = DB.getTasks();
function save() { DB.saveTasks(tasks); }
```

## 5. استبدال localStorage في team-tasks.js

```js
// قبل (قديم)
let tasks = JSON.parse(localStorage.getItem('team_tasks_v1') || '[]');
function save() { localStorage.setItem('team_tasks_v1', JSON.stringify(tasks)); }

// بعد (مع db.js)
let tasks = DB.getTeamTasks();
function save() { DB.saveTeamTasks(tasks); }
```

## 6. الوضع المظلم — اربطه بـ db.js في كل الصفحات

```js
// بدل localStorage.getItem('dark')
function toggleDark() {
    document.body.classList.toggle('dark');
    DB.setDarkMode(document.body.classList.contains('dark'));
}

// في init()
if (DB.getDarkMode()) {
    document.body.classList.add('dark');
    document.getElementById('darkmode-toggle').checked = true;
}
```

## 7. صفحة profile.js — ربط البيانات الحقيقية

```js
// في init()
const user = DB.getCurrentUser();
document.getElementById('fullname').value  = user.name;
document.getElementById('email').value     = user.email;
document.getElementById('phone').value     = user.phone;
document.getElementById('birthdate').value = user.birthdate;
document.getElementById('city').value      = user.city;
if (user.avatar) document.getElementById('avatar-img').src = user.avatar;

// عند الحفظ
function saveProfile(e) {
    e.preventDefault();
    DB.updateProfile({
        name:      document.getElementById('fullname').value.trim(),
        phone:     document.getElementById('phone').value.trim(),
        birthdate: document.getElementById('birthdate').value,
        city:      document.getElementById('city').value.trim(),
    });
}

// تسجيل الخروج
function logout() {
    DB.logout();
    window.location.href = 'logIn.html';
}
```

## 8. الإشعارات في profile.js

```js
// تحميل
const notifs = DB.getNotifs();
document.getElementById('notif-tasks').checked = notifs.tasks;
document.getElementById('notif-team').checked  = notifs.team;
document.getElementById('notif-email').checked = notifs.email;
document.getElementById('notif-app').checked   = notifs.app;

// حفظ عند التغيير
function saveNotif(key, val) {
    const n = DB.getNotifs();
    n[key] = val;
    DB.saveNotifs(n);
}
// مثال: onchange="saveNotif('tasks', this.checked)"
```

---

## هيكل البيانات في localStorage

```
app_accounts              ← قائمة جميع الحسابات (موجودة مرة واحدة)
app_current_uid           ← الحساب النشط حالياً

user_u_123_tasks          ← مهام المستخدم 123 فقط
user_u_123_team_tasks     ← مهام الفريق للمستخدم 123 فقط
user_u_123_settings       ← إعدادات المستخدم 123 (dark mode...)
user_u_123_notifs         ← إشعارات المستخدم 123

user_u_456_tasks          ← مهام المستخدم 456 (منفصلة تماماً)
user_u_456_team_tasks     ← مهام الفريق للمستخدم 456
...
```

> ✅ لا يوجد أي تداخل بين بيانات الحسابات