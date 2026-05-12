// ============================================================
//  home.js — إدارة المهام | مرتبط بـ db.js
// ============================================================

// ===== STATE =====
let tasks         = [];
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();
let currentFilter = 'all';
let pendingFiles  = [];

const MONTHS_AR = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

// ============================================================
//  INIT
// ============================================================
function init() {

    // 1. حماية — إذا ما في جلسة ارجع لتسجيل الدخول
    if (!DB.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // 2. تحميل مهام الحساب الحالي من db.js
    tasks = DB.getTasks();

    // 3. تاريخ اليوم
    const now = new Date(); // ← معرّف هنا يُستخدم في هذه الدالة فقط
    document.getElementById('today-date').textContent =
        now.toLocaleDateString('ar-SA', {
            weekday: 'long', year: 'numeric',
            month:   'long', day:  'numeric'
        });

    // 4. القيمة الافتراضية لحقل الموعد
    document.getElementById('m-deadline').value = now.toISOString().split('T')[0];

    // 5. الوضع المظلم من حساب المستخدم
    if (DB.getDarkMode()) {
        document.body.classList.add('dark');
        document.getElementById('darkmode-toggle').checked = true;
    }

    // 6. بطاقات الأولوية
    highlightSelectedPriority();
    document.querySelectorAll('.p-option input').forEach(r =>
        r.addEventListener('change', highlightSelectedPriority)
    );

    // 7. Drag & Drop
    initFileDrop();

    // 8. اختصارات لوحة المفاتيح
    document.addEventListener('keydown', onKeyDown);

    // 9. رسم
    renderAll();
    renderCalendar();
}

// ============================================================
//  SAVE — يحفظ في مساحة الحساب الحالي فقط
// ============================================================
function save() {
    DB.saveTasks(tasks);
}

// ============================================================
//  DARK MODE
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
//  AI: كشف الفترة من تاريخ التسليم
// ============================================================
function aiDetectPeriod() {
    const dl = document.getElementById('m-deadline').value;
    if (!dl) return;

    const days  = daysLeft(dl);
    const badge = document.getElementById('ai-period-badge');
    const text  = document.getElementById('ai-period-text');

    badge.style.display = 'flex';

    if (days < 0) {
        badge.className = 'ai-period-badge ai-red';
        text.textContent = '🤖 مهمة متأخرة — تصنيف: اليوم';
    } else if (days <= 1) {
        badge.className = 'ai-period-badge ai-red';
        text.textContent = `🤖 ${days === 0 ? 'اليوم' : 'غداً'} — تصنيف: مهام اليوم`;
    } else if (days <= 7) {
        badge.className = 'ai-period-badge ai-orange';
        text.textContent = `🤖 ${days} أيام — تصنيف: مهام الأسبوع`;
    } else {
        badge.className = 'ai-period-badge ai-green';
        text.textContent = `🤖 ${days} يوم — تصنيف: مهام الشهر`;
    }
}

// ============================================================
//  AI: لون المهمة حسب الأيام المتبقية
// ============================================================
function aiUrgencyClass(deadlineStr, done) {
    if (done) return 'ai-urgency-done';
    const d = daysLeft(deadlineStr);
    if (d < 0)  return 'ai-urgency-overdue';
    if (d <= 2) return 'ai-urgency-red';
    if (d <= 7) return 'ai-urgency-orange';
    return 'ai-urgency-normal';
}

// ============================================================
//  MODAL
// ============================================================
function openModal() {
    document.getElementById('modal-overlay').classList.add('show');
    document.getElementById('ai-period-badge').style.display = 'none';
    setTimeout(() => document.getElementById('m-name').focus(), 100);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
    resetModal();
}

function closeModalOutside(e) {
    if (e.target.id === 'modal-overlay') closeModal();
}

function resetModal() {
    document.getElementById('m-name').value    = '';
    document.getElementById('m-desc').value    = '';
    document.getElementById('m-files').value   = '';
    document.getElementById('file-preview').innerHTML = '';
    document.getElementById('ai-period-badge').style.display = 'none';
    pendingFiles = [];
    document.querySelector('input[name="m-priority"][value="medium"]').checked = true;
    highlightSelectedPriority();
    document.getElementById('m-deadline').value = new Date().toISOString().split('T')[0];
}

function onKeyDown(e) {
    const open = document.getElementById('modal-overlay').classList.contains('show');
    if (e.key === 'Escape' && open)  closeModal();
    if (e.key === 'n'      && !open) openModal();
}

// ============================================================
//  PRIORITY CARDS
// ============================================================
function highlightSelectedPriority() {
    document.querySelectorAll('.p-card').forEach(c => c.classList.remove('selected'));
    const checked = document.querySelector('input[name="m-priority"]:checked');
    if (checked) checked.nextElementSibling.classList.add('selected');
}

// ============================================================
//  FILE ATTACHMENTS
// ============================================================
function initFileDrop() {
    const fd = document.getElementById('file-drop');
    if (!fd) return;
    ['dragenter','dragover'].forEach(ev =>
        fd.addEventListener(ev, e => { e.preventDefault(); fd.classList.add('drag-over'); })
    );
    ['dragleave','drop'].forEach(ev =>
        fd.addEventListener(ev, e => { e.preventDefault(); fd.classList.remove('drag-over'); })
    );
    fd.addEventListener('drop', e => {
        pendingFiles = Array.from(e.dataTransfer.files);
        renderFilePreview();
    });
}

function previewFiles() {
    pendingFiles = Array.from(document.getElementById('m-files').files);
    renderFilePreview();
}

function renderFilePreview() {
    document.getElementById('file-preview').innerHTML =
        pendingFiles.map((f, i) => `
            <div class="file-chip">
                <span>${fileIcon(f.name)}</span>
                <span class="fc-name">${f.name}</span>
                <span class="fc-size">${fmtSize(f.size)}</span>
                <button class="fc-del" onclick="removeFile(${i})">✕</button>
            </div>`
        ).join('');
}

function removeFile(i) {
    pendingFiles.splice(i, 1);
    renderFilePreview();
}

function fileIcon(name) {
    const e = (name || '').split('.').pop().toLowerCase();
    return { pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',
             png:'🖼',jpg:'🖼',jpeg:'🖼',gif:'🖼',zip:'🗜',mp4:'🎬' }[e] || '📎';
}

function fmtSize(b) {
    if (b < 1024)    return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
}

// ============================================================
//  ADD TASK
// ============================================================
function addTask() {
    const name = document.getElementById('m-name').value.trim();
    const dl   = document.getElementById('m-deadline').value;

    if (!name) { shake('m-name');     return; }
    if (!dl)   { shake('m-deadline'); return; }

    // AI يحدد الفترة
    const days = daysLeft(dl);
    const period = days <= 1 ? 'today' : days <= 7 ? 'week' : 'month';

    const newTask = {
        id:          Date.now(),
        name,
        desc:        document.getElementById('m-desc').value.trim(),
        deadline:    dl,
        period,
        priority:    document.querySelector('input[name="m-priority"]:checked').value,
        done:        false,
        date:        Date.now(),
        attachments: pendingFiles.map(f => ({ name: f.name, size: f.size }))
    };

    tasks.push(newTask);
    save();          // ← يحفظ في localStorage للحساب الحالي
    closeModal();
    renderAll();
    renderCalendar();
}

function shake(id) {
    const el = document.getElementById(id);
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
}

// ============================================================
//  FILTER / SORT
// ============================================================
function setFilter(f, btn) {
    currentFilter = f;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    renderAll();
}

// ============================================================
//  RENDER ALL
// ============================================================
function renderAll() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const sort   = document.getElementById('sort-select').value;

    let filtered = tasks.filter(t =>
        t.name.toLowerCase().includes(search) ||
        (t.desc || '').toLowerCase().includes(search)
    );

    if (currentFilter !== 'all') {
        filtered = filtered.filter(t => t.period === currentFilter);
    }

    const pOrd = { high: 0, medium: 1, low: 2 };
    if      (sort === 'priority')  filtered.sort((a, b) => pOrd[a.priority] - pOrd[b.priority]);
    else if (sort === 'deadline')  filtered.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    else if (sort === 'date')      filtered.sort((a, b) => b.date - a.date);
    else if (sort === 'completed') filtered.sort((a, b) => b.done - a.done);

    ['today', 'week', 'month'].forEach(period => {
        const pt = filtered.filter(t => t.period === period);
        document.getElementById(`badge-${period}`).textContent = pt.length;
        document.getElementById(`list-${period}`).innerHTML    = pt.length
            ? pt.map(taskHTML).join('')
            : `<li class="empty-msg">لا توجد مهام ✨</li>`;
    });

    updateStats();
    updateProgress();
}

// ============================================================
//  HELPERS
// ============================================================
function daysLeft(dl) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const d = new Date(dl); d.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
}

function dlBadge(dl) {
    const d = daysLeft(dl);
    if (d < 0)   return `<span class="dl-badge overdue">متأخر ${Math.abs(d)} ي</span>`;
    if (d === 0) return `<span class="dl-badge dl-today">اليوم!</span>`;
    if (d <= 2)  return `<span class="dl-badge dl-soon">${d} أيام</span>`;
    return           `<span class="dl-badge dl-ok">${d} يوم</span>`;
}

function fmtDate(s) {
    return new Date(s).toLocaleDateString('ar-SA', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

// ============================================================
//  TASK CARD HTML
// ============================================================
function taskHTML(t) {
    const pCls    = { high: 'ph', medium: 'pm', low: 'pl' }[t.priority];
    const pLbl    = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }[t.priority];
    const urgency = aiUrgencyClass(t.deadline, t.done);

    const d = daysLeft(t.deadline);
    let aiLabel = '';
    if (!t.done) {
        if (d < 0)       aiLabel = `<span class="ai-label ai-label-red">🤖 متأخرة</span>`;
        else if (d <= 2) aiLabel = `<span class="ai-label ai-label-red">🤖 عاجل</span>`;
        else if (d <= 7) aiLabel = `<span class="ai-label ai-label-orange">🤖 قريب</span>`;
        else             aiLabel = `<span class="ai-label ai-label-green">🤖 بعيد</span>`;
    }

    const attHTML = t.attachments?.length
        ? `<div class="task-atts">${t.attachments.map(a =>
               `<span class="att-chip">${fileIcon(a.name)} ${a.name}</span>`
           ).join('')}</div>`
        : '';

    const descHTML = t.desc ? `<div class="task-desc">${t.desc}</div>` : '';

    return `
    <li class="task-item ${t.done ? 'done' : ''} ${urgency}" data-id="${t.id}">
        <label class="task-check">
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})">
            <span class="check-box"></span>
        </label>
        <div class="task-body">
            <div class="task-row1">
                <span class="task-name">${t.name}</span>
                <div class="task-actions">
                    ${aiLabel}
                    <span class="ptag ${pCls}">${pLbl}</span>
                    ${dlBadge(t.deadline)}
                    <button class="task-del" onclick="deleteTask(${t.id})">✕</button>
                </div>
            </div>
            ${descHTML}
            <div class="task-deadline-row">
                <span>📅</span>
                <span>${fmtDate(t.deadline)}</span>
            </div>
            ${attHTML}
        </div>
    </li>`;
}

// ============================================================
//  TASK ACTIONS
// ============================================================
function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (t) {
        t.done = !t.done;
        save();
        renderAll();
        renderCalendar();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
    renderAll();
    renderCalendar();
}

function deleteDone() {
    tasks = tasks.filter(t => !t.done);
    save();
    renderAll();
    renderCalendar();
}

// ============================================================
//  STATS & PROGRESS
// ============================================================
function updateStats() {
    document.getElementById('stat-today').textContent  = tasks.filter(t => t.period === 'today').length;
    document.getElementById('stat-week').textContent   = tasks.filter(t => t.period === 'week').length;
    document.getElementById('stat-done').textContent   = tasks.filter(t => t.done).length;
    document.getElementById('stat-urgent').textContent = tasks.filter(t => daysLeft(t.deadline) <= 2 && !t.done).length;
}

function updateProgress() {
    const total = tasks.length;
    const done  = tasks.filter(t => t.done).length;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    document.getElementById('progress-fill').style.width  = pct + '%';
    document.getElementById('progress-label').textContent = pct + '%';
}

// ============================================================
//  CALENDAR
// ============================================================
function renderCalendar() {
    document.getElementById('cal-label').textContent = `${MONTHS_AR[calMonth]} ${calYear}`;

    const firstDay    = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today       = new Date();
    const container   = document.getElementById('calendar-days');

    container.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        container.innerHTML += `<div class="cal-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = (
            d === today.getDate() &&
            calMonth === today.getMonth() &&
            calYear  === today.getFullYear()
        );

        const dayTasks    = tasks.filter(t => t.deadline === ds);
        const activeTasks = dayTasks.filter(t => !t.done);

        let dotCls = 'dot-l';
        if      (activeTasks.some(t => daysLeft(t.deadline) <= 2)) dotCls = 'dot-h';
        else if (activeTasks.some(t => daysLeft(t.deadline) <= 7)) dotCls = 'dot-m';

        const dotHTML   = dayTasks.length ? `<span class="cal-dot ${dotCls}"></span>` : '';
        const cntBadge  = dayTasks.length ? `<span class="cal-count">${dayTasks.length}</span>` : '';

        container.innerHTML += `
            <div class="cal-day ${isToday ? 'today' : ''} ${dayTasks.length ? 'has-tasks' : ''}"
                 data-date="${ds}"
                 onmouseenter="showTT(event,'${ds}')"
                 onmouseleave="hideTT()"
                 onclick="openCalDetail('${ds}')">
                <span class="cal-day-num">${d}</span>
                ${dotHTML}
                ${cntBadge}
            </div>`;
    }
}

function prevMonth() { calMonth--; if (calMonth < 0)  { calMonth = 11; calYear--; } renderCalendar(); }
function nextMonth() { calMonth++; if (calMonth > 11) { calMonth = 0;  calYear++; } renderCalendar(); }

// ============================================================
//  CALENDAR TOOLTIP (hover)
// ============================================================
function showTT(e, ds) {
    const dayTasks = tasks.filter(t => t.deadline === ds && !t.done);
    if (!dayTasks.length) return;

    const pL  = { high: '🔴', medium: '🟡', low: '🟢' };
    const tip = document.getElementById('cal-tooltip');

    tip.innerHTML =
        `<div class="tt-date">${fmtDate(ds)}</div>` +
        dayTasks.map(t => {
            const d   = daysLeft(t.deadline);
            const rem = d === 0 ? 'اليوم!'
                      : d < 0  ? `متأخر ${Math.abs(d)} يوم`
                      : `${d} يوم متبقي`;
            return `<div class="tt-task">
                        <span class="tt-name">${pL[t.priority]} ${t.name}</span>
                        <span class="tt-meta">${rem}</span>
                    </div>`;
        }).join('');

    const r = e.target.getBoundingClientRect();
    tip.style.top  = (r.bottom + window.scrollY + 8) + 'px';
    tip.style.left = Math.min(r.left + window.scrollX, window.innerWidth - 260) + 'px';
    tip.classList.add('show');
}

function hideTT() {
    document.getElementById('cal-tooltip').classList.remove('show');
}

// ============================================================
//  CALENDAR DETAIL PANEL (click)
// ============================================================
function openCalDetail(ds) {
    hideTT();
    const dayTasks = tasks.filter(t => t.deadline === ds);
    document.getElementById('cal-detail-date').textContent = fmtDate(ds);

    const pLabel = { high: '🔴 عالية', medium: '🟡 متوسطة', low: '🟢 منخفضة' };

    const urgencyBadge = (t) => {
        if (t.done) return `<span class="cd-done-badge">✅ مكتملة</span>`;
        const d = daysLeft(t.deadline);
        if (d < 0)  return `<span class="cd-badge cd-red">⚠️ متأخرة</span>`;
        if (d <= 2) return `<span class="cd-badge cd-red">🔥 عاجل</span>`;
        if (d <= 7) return `<span class="cd-badge cd-orange">⏰ قريب</span>`;
        return          `<span class="cd-badge cd-green">✓ بعيد</span>`;
    };

    document.getElementById('cal-detail-tasks').innerHTML = !dayTasks.length
        ? `<div class="cd-empty">لا توجد مهام في هذا اليوم 📭</div>`
        : dayTasks.map(t => `
            <div class="cd-task ${t.done ? 'cd-task-done' : ''}">
                <div class="cd-task-top">
                    <label class="cd-check" onclick="toggleTaskFromCal(${t.id},'${ds}')">
                        <span class="cd-checkmark">${t.done ? '✓' : ''}</span>
                    </label>
                    <div class="cd-task-info">
                        <div class="cd-task-name">${t.name}</div>
                        <div class="cd-task-meta">${pLabel[t.priority]} · ${urgencyBadge(t)}</div>
                    </div>
                    <button class="cd-delete" onclick="deleteFromCal(${t.id},'${ds}')">✕</button>
                </div>
                ${t.desc ? `<div class="cd-task-desc">${t.desc}</div>` : ''}
                ${t.attachments?.length
                    ? `<div class="cd-atts">${t.attachments.map(a =>
                          `<span class="att-chip">${fileIcon(a.name)} ${a.name}</span>`
                      ).join('')}</div>`
                    : ''}
            </div>`
        ).join('');

    document.getElementById('cal-detail-overlay').classList.add('show');
}

function toggleTaskFromCal(id, ds) {
    const t = tasks.find(t => t.id === id);
    if (t) { t.done = !t.done; save(); renderAll(); renderCalendar(); openCalDetail(ds); }
}

function deleteFromCal(id, ds) {
    tasks = tasks.filter(t => t.id !== id);
    save();
    renderAll();
    renderCalendar();
    openCalDetail(ds);
}

function closeCalDetail(e) {
    if (e.target.id === 'cal-detail-overlay') closeCalDetailBtn();
}

function closeCalDetailBtn() {
    document.getElementById('cal-detail-overlay').classList.remove('show');
}

// ============================================================
//  START
// ============================================================
window.addEventListener('DOMContentLoaded', init);