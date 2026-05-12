// ============================================================
//  auth-guard.js
//  أضف هذا الملف في أي صفحة محمية تحتاج تسجيل دخول
//  <script src="db.js"></script>
//  <script src="auth-guard.js"></script>
// ============================================================

(function () {
    // إذا المستخدم غير مسجل دخول → أعِد التوجيه
    if (!DB.isLoggedIn()) {
        window.location.replace('index.html');
    }

    // تطبيق الوضع المظلم المحفوظ للحساب
    if (DB.getDarkMode()) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
    }
})();