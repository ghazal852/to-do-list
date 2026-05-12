// ============================================================
//  profile.js — مرتبط بـ db.js
// ============================================================

let isEditing = false;

// ============================================================
//  INIT
// ============================================================
function init() {
    // ── حماية الصفحة ──
    if (!DB.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // ── الوضع المظلم من حساب المستخدم ──
    if (DB.getDarkMode()) {
        document.body.classList.add('dark');
        document.getElementById('darkmode-toggle').checked = true;
    }

    // ── تحميل بيانات المستخدم من db.js ──
    const user = DB.getCurrentUser();
    if (!user) { DB.logout(); window.location.href = 'index.html'; return; }

    loadUserData(user);
    loadNotifs();

    // ── ربط قوة كلمة المرور ──
    document.getElementById('new-pass').addEventListener('input', checkStrength);
}

// ============================================================
//  LOAD USER DATA
// ============================================================
function loadUserData(user) {
    document.getElementById('fullname').value  = user.name      || '';
    document.getElementById('phone').value     = user.phone     || '';
    document.getElementById('email').value     = user.email     || '';
    document.getElementById('birthdate').value = user.birthdate || '';
    document.getElementById('city').value      = user.city      || '';

    // بطاقة الأفاتار
    document.getElementById('display-name').textContent  = user.name  || '—';
    document.getElementById('display-email').textContent = user.email || '—';

    // البريد في قسم التعديل
    document.getElementById('current-email-display').value = user.email || '';

    // الصورة
    if (user.avatar) {
        document.getElementById('avatar-img').src = user.avatar;
    }
}

// ============================================================
//  LOAD NOTIFICATIONS
// ============================================================
function loadNotifs() {
    const n = DB.getNotifs();
    document.getElementById('notif-tasks').checked = n.tasks;
    document.getElementById('notif-team').checked  = n.team;
    document.getElementById('notif-email').checked = n.email;
    document.getElementById('notif-app').checked   = n.app;
}

// ============================================================
//  SAVE NOTIFICATION
// ============================================================
function saveNotif(key, val) {
    const n = DB.getNotifs();
    n[key]  = val;
    DB.saveNotifs(n);
    showToast(`✅ تم ${val ? 'تفعيل' : 'إيقاف'} الإشعار`);
}

// ============================================================
//  DARK MODE — محفوظ في حساب المستخدم
// ============================================================
function toggleDark() {
    document.body.classList.toggle('dark');
    DB.setDarkMode(document.body.classList.contains('dark'));
}

// ============================================================
//  SIDEBAR
// ============================================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('hamburger').classList.toggle('open');
}

// ============================================================
//  AVATAR CHANGE
// ============================================================
function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const src = e.target.result;
        document.getElementById('avatar-img').src = src;
        DB.updateProfile({ avatar: src });
        showToast('✅ تم تحديث الصورة الشخصية');
    };
    reader.readAsDataURL(file);
}

// ============================================================
//  EDIT PROFILE
// ============================================================
function toggleEdit() {
    isEditing = !isEditing;
    const inputs  = document.querySelectorAll('#profile-form .form-input');
    const actions = document.getElementById('form-actions');
    const editBtn = document.getElementById('edit-btn');

    inputs.forEach(input => { input.disabled = !isEditing; });
    actions.style.display = isEditing ? 'flex' : 'none';
    editBtn.textContent   = isEditing ? '❌ إلغاء' : '✏️ تعديل';

    if (!isEditing) cancelEdit();
}

function cancelEdit() {
    isEditing = false;
    const inputs  = document.querySelectorAll('#profile-form .form-input');
    const actions = document.getElementById('form-actions');
    const editBtn = document.getElementById('edit-btn');

    inputs.forEach(input => { input.disabled = true; });
    actions.style.display = 'none';
    editBtn.textContent   = '✏️ تعديل';

    // إعادة تحميل البيانات الأصلية
    const user = DB.getCurrentUser();
    if (user) loadUserData(user);
}

function saveProfile(e) {
    e.preventDefault();
    const result = DB.updateProfile({
        name:      document.getElementById('fullname').value.trim(),
        phone:     document.getElementById('phone').value.trim(),
        birthdate: document.getElementById('birthdate').value,
        city:      document.getElementById('city').value.trim(),
    });

    if (!result.success) { showToast('❌ ' + result.error); return; }

    // تحديث بطاقة الأفاتار
    const user = DB.getCurrentUser();
    document.getElementById('display-name').textContent  = user.name;
    document.getElementById('display-email').textContent = user.email;

    cancelEdit();
    showToast('✅ تم حفظ المعلومات الشخصية');
}

// ============================================================
//  CHANGE EMAIL
// ============================================================
function changeEmail(e) {
    e.preventDefault();
    const newEmail     = document.getElementById('new-email').value.trim();
    const confirmEmail = document.getElementById('confirm-email').value.trim();

    if (!newEmail || !confirmEmail) { showToast('⚠️ يرجى ملء جميع الحقول'); return; }
    if (newEmail !== confirmEmail)  { showToast('❌ البريدان غير متطابقين');  return; }
    if (!newEmail.includes('@'))    { showToast('❌ صيغة البريد غير صحيحة'); return; }

    const result = DB.updateProfile({ email: newEmail });
    if (!result.success) { showToast('❌ ' + result.error); return; }

    document.getElementById('current-email-display').value = newEmail;
    document.getElementById('email').value                 = newEmail;
    document.getElementById('display-email').textContent   = newEmail;
    document.getElementById('new-email').value             = '';
    document.getElementById('confirm-email').value         = '';
    showToast('✅ تم تحديث البريد الإلكتروني');
}

// ============================================================
//  CHANGE PASSWORD
// ============================================================
function checkStrength() {
    const val  = document.getElementById('new-pass').value;
    const fill = document.getElementById('strength-fill');
    const lbl  = document.getElementById('strength-label');
    let s = 0;
    if (val.length >= 6)            s++;
    if (val.length >= 10)           s++;
    if (/[A-Z]/.test(val))         s++;
    if (/[0-9]/.test(val))         s++;
    if (/[^A-Za-z0-9]/.test(val)) s++;
    const levels = [
        {pct:'0%',   color:'#e2e8f0', label:''},
        {pct:'25%',  color:'#ef4444', label:'ضعيفة جداً'},
        {pct:'50%',  color:'#f59e0b', label:'ضعيفة'},
        {pct:'70%',  color:'#3b82f6', label:'متوسطة'},
        {pct:'85%',  color:'#22c55e', label:'قوية'},
        {pct:'100%', color:'#16a34a', label:'قوية جداً ✅'},
    ];
    const lvl = levels[Math.min(s, 5)];
    fill.style.width      = lvl.pct;
    fill.style.background = lvl.color;
    lbl.textContent       = lvl.label;
    lbl.style.color       = lvl.color;
}

function changePassword(e) {
    e.preventDefault();
    const newP    = document.getElementById('new-pass').value;
    const confirm = document.getElementById('confirm-pass').value;

    if (!document.getElementById('current-pass').value) {
        showToast('⚠️ أدخل كلمة المرور الحالية'); return;
    }
    if (!newP || !confirm) { showToast('⚠️ يرجى ملء جميع الحقول'); return; }
    if (newP.length < 6)   { showToast('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newP !== confirm)   { showToast('❌ كلمتا المرور غير متطابقتين'); return; }

    DB.updateProfile({ password: newP });

    document.getElementById('current-pass').value = '';
    document.getElementById('new-pass').value     = '';
    document.getElementById('confirm-pass').value = '';
    document.getElementById('strength-fill').style.width = '0%';
    document.getElementById('strength-label').textContent = '';
    showToast('✅ تم تغيير كلمة المرور بنجاح');
}

// ============================================================
//  TOGGLE PASSWORD VISIBILITY
// ============================================================
function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    input.type  = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

// ============================================================
//  LOGOUT — ✅ يستدعي DB.logout() لإنهاء الجلسة
// ============================================================
function confirmLogout() {
    document.getElementById('logout-modal').classList.add('show');
}

function closeModal() {
    document.getElementById('logout-modal').classList.remove('show');
}

function logout() {
    // ✅ 1. إنهاء الجلسة من db.js (يمسح app_current_uid)
    DB.logout();

    // ✅ 2. إخفاء المودال
    closeModal();

    // ✅ 3. إعادة التوجيه لصفحة الدخول
    showToast('👋 تم تسجيل الخروج، إلى اللقاء!');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
}

// إغلاق المودال بالنقر خارجه
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('logout-modal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });
});

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// ============================================================
//  START
// ============================================================
window.addEventListener('DOMContentLoaded', init);