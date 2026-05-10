// ============================================================
//  db.js — نظام إدارة الحسابات والبيانات
//  إصدار مُصلح — يحل مشكلة ضياع البيانات عند تسجيل الخروج
//  وعند تحديث الصفحة
// ============================================================

const DB = (() => {

    const ACCOUNTS_KEY = 'app_accounts';   // جميع بيانات الحسابات
    const SESSION_KEY  = 'app_session';    // الحساب النشط حالياً

    // ============================================================
    //  HELPERS
    // ============================================================

    function getAllAccounts() {
        try {
            return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function saveAllAccounts(accounts) {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }

    // مفتاح تخزين خاص بكل حساب وقسم
    // مثال: user_u123_tasks
    function userKey(uid, section) {
        return 'user_' + uid + '_' + section;
    }

    function generateUID() {
        return 'u' + Date.now() + Math.random().toString(36).slice(2, 7);
    }

    // قراءة آمنة من localStorage
    function lsGet(key) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    // كتابة آمنة في localStorage
    function lsSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    // ============================================================
    //  ACCOUNT MANAGEMENT
    // ============================================================

    /**
     * إنشاء حساب جديد
     * يُهيّئ مساحة بيانات خاصة للحساب فقط إذا لم تكن موجودة
     */
    function register(data) {
        const { name, email, password } = data;

        if (!name || !email || !password) {
            return { success: false, error: 'الاسم والإيميل وكلمة المرور مطلوبة' };
        }
        if (!email.includes('@')) {
            return { success: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
        }
        if (password.length < 6) {
            return { success: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
        }

        const accounts = getAllAccounts();

        // التحقق من عدم تكرار الإيميل
        const emailLower = email.toLowerCase().trim();
        const exists = Object.values(accounts).find(a => a.email === emailLower);
        if (exists) {
            return { success: false, error: 'البريد الإلكتروني مسجل مسبقاً' };
        }

        const uid = generateUID();

        accounts[uid] = {
            uid,
            name:      name.trim(),
            email:     emailLower,
            password:  btoa(unescape(encodeURIComponent(password))), // base64
            phone:     data.phone     || '',
            birthdate: data.birthdate || '',
            city:      data.city      || '',
            avatar:    data.avatar    || '',
            createdAt: Date.now(),
        };

        saveAllAccounts(accounts);

        // تهيئة مساحة البيانات — فقط إذا لم تكن موجودة
        _ensureUserData(uid);

        return { success: true, uid };
    }

    /**
     * تسجيل الدخول
     */
    function login(email, password) {
        const accounts  = getAllAccounts();
        const emailLower = email.toLowerCase().trim();
        const passHash   = btoa(unescape(encodeURIComponent(password)));

        const user = Object.values(accounts).find(
            a => a.email === emailLower && a.password === passHash
        );

        if (!user) {
            return { success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
        }

        // حفظ الجلسة — يضمن استمرارية البيانات بعد التحديث
        lsSet(SESSION_KEY, { uid: user.uid, loginAt: Date.now() });

        // تأكد من وجود مساحة البيانات
        _ensureUserData(user.uid);

        return { success: true, uid: user.uid, user: _safeUser(user) };
    }

    /**
     * تسجيل الخروج
     */
    function logout() {
        localStorage.removeItem(SESSION_KEY);
        // ✅ لا نمسح البيانات (tasks, settings...) — تبقى محفوظة للدخول القادم
    }

    function getCurrentUID() {
        const session = lsGet(SESSION_KEY);
        return session && session.uid ? session.uid : null;
    }

    function getCurrentUser() {
        const uid = getCurrentUID();
        if (!uid) return null;
        const accounts = getAllAccounts();
        const user = accounts[uid];
        return user ? _safeUser(user) : null;
    }

    function isLoggedIn() {
        return !!getCurrentUID();
    }

    /**
     * تحديث بيانات الملف الشخصي
     */
    function updateProfile(updates) {
        const uid = getCurrentUID();
        if (!uid) return { success: false, error: 'غير مسجل الدخول' };

        const accounts = getAllAccounts();
        if (!accounts[uid]) return { success: false, error: 'الحساب غير موجود' };

        const allowed = ['name', 'phone', 'birthdate', 'city', 'avatar'];
        allowed.forEach(k => {
            if (updates[k] !== undefined) accounts[uid][k] = updates[k];
        });

        if (updates.email) {
            const emailLower = updates.email.toLowerCase().trim();
            const taken = Object.values(accounts).find(
                a => a.email === emailLower && a.uid !== uid
            );
            if (taken) return { success: false, error: 'البريد الإلكتروني مستخدم من حساب آخر' };
            accounts[uid].email = emailLower;
        }

        if (updates.password) {
            accounts[uid].password = btoa(unescape(encodeURIComponent(updates.password)));
        }

        saveAllAccounts(accounts);
        return { success: true };
    }

    function _safeUser(user) {
        const { password, ...safe } = user;
        return safe;
    }

    // ============================================================
    //  DATA ISOLATION
    //  يضمن وجود مساحة بيانات لكل حساب دون مسح الموجود
    // ============================================================

    /**
     * ✅ الإصلاح الرئيسي:
     * تتحقق من وجود البيانات قبل إنشائها — لا تمسح أبداً
     */
    function _ensureUserData(uid) {
        if (lsGet(userKey(uid, 'tasks'))      === null) lsSet(userKey(uid, 'tasks'),      []);
        if (lsGet(userKey(uid, 'team_tasks')) === null) lsSet(userKey(uid, 'team_tasks'), []);
        if (lsGet(userKey(uid, 'settings'))   === null) lsSet(userKey(uid, 'settings'),   { dark: false });
        if (lsGet(userKey(uid, 'notifs'))     === null) lsSet(userKey(uid, 'notifs'),     { tasks: true, team: true, email: false, app: true });
    }

    // ============================================================
    //  TASKS
    // ============================================================

    function getTasks() {
        const uid = getCurrentUID();
        if (!uid) return [];
        const data = lsGet(userKey(uid, 'tasks'));
        // ✅ إذا كانت null (أول مرة) أرجع مصفوفة فارغة وحفّظها
        if (data === null) {
            lsSet(userKey(uid, 'tasks'), []);
            return [];
        }
        return Array.isArray(data) ? data : [];
    }

    function saveTasks(tasks) {
        const uid = getCurrentUID();
        if (!uid) return;
        if (!Array.isArray(tasks)) return;
        lsSet(userKey(uid, 'tasks'), tasks);
    }

    // ============================================================
    //  TEAM TASKS
    // ============================================================

    function getTeamTasks() {
        const uid = getCurrentUID();
        if (!uid) return [];
        const data = lsGet(userKey(uid, 'team_tasks'));
        if (data === null) {
            lsSet(userKey(uid, 'team_tasks'), []);
            return [];
        }
        return Array.isArray(data) ? data : [];
    }

    function saveTeamTasks(tasks) {
        const uid = getCurrentUID();
        if (!uid) return;
        if (!Array.isArray(tasks)) return;
        lsSet(userKey(uid, 'team_tasks'), tasks);
    }

    // ============================================================
    //  SETTINGS
    // ============================================================

    function getSettings() {
        const uid  = getCurrentUID();
        if (!uid) return { dark: false };
        const data = lsGet(userKey(uid, 'settings'));
        return data !== null ? data : { dark: false };
    }

    function saveSettings(settings) {
        const uid = getCurrentUID();
        if (uid) lsSet(userKey(uid, 'settings'), settings);
    }

    function getDarkMode() {
        return !!getSettings().dark;
    }

    function setDarkMode(val) {
        const s = getSettings();
        s.dark  = !!val;
        saveSettings(s);
    }

    // ============================================================
    //  NOTIFICATIONS
    // ============================================================

    function getNotifs() {
        const uid  = getCurrentUID();
        const def  = { tasks: true, team: true, email: false, app: true };
        if (!uid) return def;
        const data = lsGet(userKey(uid, 'notifs'));
        return data !== null ? data : def;
    }

    function saveNotifs(notifs) {
        const uid = getCurrentUID();
        if (uid) lsSet(userKey(uid, 'notifs'), notifs);
    }

    // ============================================================
    //  GUARD
    // ============================================================

    function requireAuth(redirectTo = 'logIn.html') {
        if (!isLoggedIn()) {
            window.location.replace(redirectTo);
            return false;
        }
        return true;
    }

    // ============================================================
    //  DEBUG
    // ============================================================

    function debugDump() {
        const uid = getCurrentUID();
        console.group('🗄 DB Debug');
        console.log('Session UID :', uid);
        console.log('User        :', getCurrentUser());
        console.log('Tasks       :', getTasks());
        console.log('Team Tasks  :', getTeamTasks());
        console.log('Settings    :', getSettings());
        console.log('Notifs      :', getNotifs());
        console.groupEnd();
    }

    // ============================================================
    //  PUBLIC API
    // ============================================================
    return {
        register,
        login,
        logout,
        getCurrentUser,
        getCurrentUID,
        isLoggedIn,
        updateProfile,
        requireAuth,

        getTasks,
        saveTasks,
        getTeamTasks,
        saveTeamTasks,

        getSettings,
        saveSettings,
        getDarkMode,
        setDarkMode,

        getNotifs,
        saveNotifs,

        debugDump,
    };

})();

window.DB = DB;