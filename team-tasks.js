// ============================================================
//  team-tasks.js — مهام الفريق | مرتبط بـ db.js
// ============================================================

let tasks        = [];
let viewMode     = 'card';
let editingId    = null;
let detailId     = null;
let pendingFiles = [];

// اسم المستخدم الحالي من الحساب
let ME = 'أنا';

// ============================================================
//  INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    // حماية الصفحة
    if (!DB.isLoggedIn()) {
        window.location.href = 'logIn.html';
        return;
    }

    // اسم المستخدم من الحساب
    const user = DB.getCurrentUser();
    if (user && user.name) ME = user.name;

    // الوضع المظلم
    if (DB.getDarkMode()) {
        document.body.classList.add('dark');
        document.getElementById('darkmode-toggle').checked = true;
    }

    // تحميل مهام الفريق من db.js
    tasks = DB.getTeamTasks();

    renderTasks();
    initFileDrop();
});

// ============================================================
//  SAVE
// ============================================================
function save() {
    DB.saveTeamTasks(tasks);
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
//  VIEW TOGGLE
// ============================================================
function toggleView() {
    viewMode = viewMode === 'card' ? 'list' : 'card';
    const btn = document.getElementById('view-toggle');
    const con = document.getElementById('tasks-container');
    if (viewMode === 'list') {
        con.classList.add('list-view');
        btn.textContent = '⊟ جدول';
        btn.classList.add('list-mode');
    } else {
        con.classList.remove('list-view');
        btn.textContent = '⊞ بطاقات';
        btn.classList.remove('list-mode');
    }
}

// ============================================================
//  DEADLINE HELPERS
// ============================================================
function daysLeft(dl) {
    const t = new Date(); t.setHours(0,0,0,0);
    const d = new Date(dl); d.setHours(0,0,0,0);
    return Math.round((d-t)/86400000);
}

function dlBadge(dl, done) {
    if (done) return `<span class="dl-badge dl-done">✅ مكتملة</span>`;
    const d = daysLeft(dl);
    if (d < 0)   return `<span class="dl-badge overdue">⚠️ متأخر ${Math.abs(d)} يوم</span>`;
    if (d === 0) return `<span class="dl-badge dl-today">📅 اليوم!</span>`;
    if (d <= 7)  return `<span class="dl-badge dl-week">📅 ${d} أيام</span>`;
    return           `<span class="dl-badge dl-ok">📅 ${d} يوم</span>`;
}

function fmtDate(s) {
    return new Date(s).toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
}

function fileIcon(name) {
    const e = (name||'').split('.').pop().toLowerCase();
    return { pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',png:'🖼',jpg:'🖼',jpeg:'🖼',zip:'🗜',mp4:'🎬' }[e]||'📎';
}

function fmtSize(b) {
    if(b<1024) return b+'B';
    if(b<1048576) return (b/1024).toFixed(1)+'KB';
    return (b/1048576).toFixed(1)+'MB';
}

// ============================================================
//  RENDER
// ============================================================
function renderTasks() {
    const search  = document.getElementById('search-input').value.toLowerCase();
    const fPerson = document.getElementById('filter-person').value;
    const fDl     = document.getElementById('filter-deadline').value;
    const sort    = document.getElementById('sort-by').value;

    let filtered = tasks.filter(t => {
        const matchSearch = t.name.toLowerCase().includes(search) ||
                            (t.desc||'').toLowerCase().includes(search);
        const matchPerson = fPerson === 'all' ? true : t.members.includes(ME);
        let matchDl = true;
        if      (fDl === 'today') matchDl = daysLeft(t.deadline) === 0;
        else if (fDl === 'week')  matchDl = daysLeft(t.deadline) >= 0 && daysLeft(t.deadline) <= 7;
        else if (fDl === 'late')  matchDl = daysLeft(t.deadline) < 0 && !t.done;
        return matchSearch && matchPerson && matchDl;
    });

    if      (sort === 'date-asc')  filtered.sort((a,b) => new Date(a.deadline)-new Date(b.deadline));
    else if (sort === 'date-desc') filtered.sort((a,b) => new Date(b.deadline)-new Date(a.deadline));
    else if (sort === 'name')      filtered.sort((a,b) => a.name.localeCompare(b.name, 'ar'));

    // Stats
    document.getElementById('stat-all').textContent  = tasks.length;
    document.getElementById('stat-mine').textContent = tasks.filter(t=>t.members.includes(ME)).length;
    document.getElementById('stat-done').textContent = tasks.filter(t=>t.done).length;
    document.getElementById('stat-late').textContent = tasks.filter(t=>daysLeft(t.deadline)<0&&!t.done).length;
    document.getElementById('tasks-count').textContent = `${filtered.length} مهام`;

    const con = document.getElementById('tasks-container');
    if (!filtered.length) {
        con.innerHTML = `<div class="empty-state">
            <span class="empty-icon">👥</span>
            <p>لا توجد مهام — أضف مهمة جديدة للبدء</p>
        </div>`;
        return;
    }
    con.innerHTML = filtered.map(taskCardHTML).join('');
}

// ============================================================
//  TASK CARD HTML
// ============================================================
function taskCardHTML(t) {
    const late    = daysLeft(t.deadline) < 0 && !t.done;
    const clsCard = `task-card${t.done?' is-done':''}${late?' is-late':''}`;
    const members = t.members.map(m => `<span class="member-chip">${m}</span>`).join('');
    const atts    = t.attachments?.length
        ? `<div class="att-row">${t.attachments.map(a=>`<span class="att-chip">${fileIcon(a.name)} ${a.name}</span>`).join('')}</div>`
        : '';
    const notes   = t.notes ? `<div class="notes-row">📝 ${t.notes}</div>` : '';
    const descEl  = t.desc  ? `<p class="task-card-desc">${t.desc}</p>` : '';

    return `
    <div class="${clsCard}" onclick="openDetail(${t.id})" data-id="${t.id}">
        <div class="task-card-header">
            <span class="task-card-title">${t.name}</span>
            <div class="task-card-actions" onclick="event.stopPropagation()">
                <button class="btn-icon done-btn" onclick="toggleDone(${t.id})" title="${t.done?'إلغاء الإنجاز':'تحديد كمكتمل'}">
                    ${t.done ? '↩' : '✓'}
                </button>
                <button class="btn-icon" onclick="openModal('edit',${t.id})" title="تعديل">✏️</button>
                <button class="btn-icon del" onclick="deleteTask(${t.id})" title="حذف">🗑</button>
            </div>
        </div>
        ${descEl}
        <div class="task-card-meta">
            ${dlBadge(t.deadline, t.done)}
            <span style="font-size:12px;color:var(--muted);">📅 ${fmtDate(t.deadline)}</span>
        </div>
        <div class="members-row">${members}</div>
        ${atts}
        ${notes}
        <div class="task-code-row" onclick="event.stopPropagation()">
            <span class="task-code-label">كود المشاركة:</span>
            <span class="task-code-value">${t.code}</span>
            <button class="btn-code-copy" onclick="copyTaskCode('${t.code}')">📋</button>
        </div>
    </div>`;
}

// ============================================================
//  TASK ACTIONS
// ============================================================
function toggleDone(id) {
    const t = tasks.find(t=>t.id===id);
    if (t) { t.done=!t.done; save(); renderTasks(); }
}

function deleteTask(id) {
    if (!confirm('هل تريد حذف هذه المهمة؟')) return;
    tasks = tasks.filter(t=>t.id!==id);
    save(); renderTasks();
    showToast('🗑 تم حذف المهمة');
}

// ============================================================
//  DETAIL MODAL
// ============================================================
function openDetail(id) {
    const t = tasks.find(t=>t.id===id);
    if (!t) return;
    detailId = id;
    document.getElementById('detail-title').textContent = t.name;

    const members = t.members.map(m=>`<span class="member-chip">${m}</span>`).join('');
    const atts = t.attachments?.length
        ? t.attachments.map(a=>`<div class="att-chip">${fileIcon(a.name)} ${a.name} (${fmtSize(a.size)})</div>`).join('')
        : '<span style="color:var(--muted);font-size:13px;">لا توجد مرفقات</span>';

    document.getElementById('detail-body').innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">📋 الوصف</div>
            <div class="detail-section-content">${t.desc || '—'}</div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">📅 موعد التسليم</div>
            <div class="detail-section-content">${fmtDate(t.deadline)} · ${dlBadge(t.deadline,t.done)}</div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">👥 الأشخاص المشاركون</div>
            <div class="members-row">${members}</div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">📎 المرفقات</div>
            <div class="att-row">${atts}</div>
        </div>
        ${t.notes ? `<div class="detail-section">
            <div class="detail-section-title">📝 ملاحظات</div>
            <div class="detail-section-content">${t.notes}</div>
        </div>` : ''}
        <div class="detail-section">
            <div class="detail-section-title">🔗 كود المشاركة</div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="task-code-value">${t.code}</span>
                <button class="btn-code-copy" onclick="copyTaskCode('${t.code}')">📋 نسخ</button>
            </div>
        </div>`;

    document.getElementById('detail-modal').classList.add('show');
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('show');
    detailId = null;
}
function closeDetailOutside(e) { if (e.target.id==='detail-modal') closeDetailModal(); }
function editFromDetail() { closeDetailModal(); openModal('edit', detailId); }

// ============================================================
//  ADD/EDIT MODAL
// ============================================================
function openModal(mode, id = null) {
    editingId    = id;
    pendingFiles = [];
    document.getElementById('file-preview').innerHTML = '';
    document.getElementById('m-files').value = '';

    if (mode === 'edit' && id) {
        const t = tasks.find(t=>t.id===id);
        document.getElementById('modal-title').textContent    = 'تعديل المهمة';
        document.getElementById('modal-save-btn').textContent = '💾 حفظ التعديلات';
        document.getElementById('m-name').value     = t.name;
        document.getElementById('m-desc').value     = t.desc || '';
        document.getElementById('m-deadline').value = t.deadline;
        document.getElementById('m-members').value  = t.members.join('، ');
        document.getElementById('m-notes').value    = t.notes || '';
        if (t.attachments?.length) {
            document.getElementById('file-preview').innerHTML =
                t.attachments.map(a=>`
                    <div class="file-chip">
                        <span>${fileIcon(a.name)}</span>
                        <span class="fc-name">${a.name}</span>
                        <span class="fc-size">${fmtSize(a.size)}</span>
                    </div>`).join('');
        }
    } else {
        document.getElementById('modal-title').textContent    = 'مهمة جديدة';
        document.getElementById('modal-save-btn').textContent = '💾 حفظ المهمة';
        document.getElementById('m-name').value     = '';
        document.getElementById('m-desc').value     = '';
        document.getElementById('m-deadline').value = new Date().toISOString().split('T')[0];
        document.getElementById('m-members').value  = ME;
        document.getElementById('m-notes').value    = '';
    }

    document.getElementById('task-modal').classList.add('show');
    setTimeout(() => document.getElementById('m-name').focus(), 100);
}

function closeModal() {
    document.getElementById('task-modal').classList.remove('show');
    editingId = null; pendingFiles = [];
}
function closeModalOutside(e) { if (e.target.id==='task-modal') closeModal(); }

// ============================================================
//  SAVE TASK
// ============================================================
function saveTask() {
    const name     = document.getElementById('m-name').value.trim();
    const deadline = document.getElementById('m-deadline').value;
    if (!name)     { shake('m-name');     return; }
    if (!deadline) { shake('m-deadline'); return; }

    const members = document.getElementById('m-members').value
        .split(/[,،]/).map(m=>m.trim()).filter(Boolean);
    const newAtts = pendingFiles.map(f=>({ name:f.name, size:f.size }));

    if (editingId) {
        const t = tasks.find(t=>t.id===editingId);
        t.name     = name;
        t.desc     = document.getElementById('m-desc').value.trim();
        t.deadline = deadline;
        t.members  = members;
        t.notes    = document.getElementById('m-notes').value.trim();
        if (newAtts.length) t.attachments = [...(t.attachments||[]), ...newAtts];
        showToast('✅ تم تعديل المهمة');
    } else {
        tasks.push({
            id:          Date.now(),
            name,
            desc:        document.getElementById('m-desc').value.trim(),
            deadline,
            members,
            notes:       document.getElementById('m-notes').value.trim(),
            attachments: newAtts,
            done:        false,
            code:        genCode(),
            date:        Date.now()
        });
        showToast('✅ تمت إضافة المهمة');
    }

    save(); closeModal(); renderTasks();
}

function shake(id) {
    const el = document.getElementById(id);
    el.classList.add('shake');
    setTimeout(()=>el.classList.remove('shake'), 500);
}

// ============================================================
//  CODE
// ============================================================
function genCode() {
    return 'TM' + Math.random().toString(36).toUpperCase().slice(2,8);
}
function generateCode() {
    const code = genCode();
    document.getElementById('generated-code').textContent = code;
    document.getElementById('code-display').style.display = 'flex';
}
function copyCode() {
    const code = document.getElementById('generated-code').textContent;
    navigator.clipboard.writeText(code).then(() => showToast('📋 تم نسخ الكود: ' + code));
}
function copyTaskCode(code) {
    navigator.clipboard.writeText(code).then(() => showToast('📋 تم نسخ الكود: ' + code));
}
function joinByCode() {
    const code  = document.getElementById('code-input').value.trim().toUpperCase();
    if (!code) { showToast('⚠️ أدخل الكود أولاً'); return; }
    const found = tasks.find(t => t.code === code);
    if (found) {
        if (!found.members.includes(ME)) {
            found.members.push(ME);
            save(); renderTasks();
            showToast(`✅ تمت إضافتك لمهمة: ${found.name}`);
        } else {
            showToast('ℹ️ أنت مضاف بالفعل لهذه المهمة');
        }
    } else {
        showToast('❌ الكود غير صحيح أو غير موجود');
    }
    document.getElementById('code-input').value = '';
}

// ============================================================
//  FILE ATTACHMENTS
// ============================================================
function initFileDrop() {
    const fd = document.getElementById('file-drop');
    if (!fd) return;
    ['dragenter','dragover'].forEach(ev =>
        fd.addEventListener(ev, e=>{e.preventDefault();fd.classList.add('drag-over');}));
    ['dragleave','drop'].forEach(ev =>
        fd.addEventListener(ev, e=>{e.preventDefault();fd.classList.remove('drag-over');}));
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
        pendingFiles.map((f,i)=>`
            <div class="file-chip">
                <span>${fileIcon(f.name)}</span>
                <span class="fc-name">${f.name}</span>
                <span class="fc-size">${fmtSize(f.size)}</span>
                <button class="fc-del" onclick="removeFile(${i})">✕</button>
            </div>`).join('');
}
function removeFile(i) { pendingFiles.splice(i,1); renderFilePreview(); }

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, duration=3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), duration);
}

// ============================================================
//  KEYBOARD
// ============================================================
document.addEventListener('keydown', e => {
    if (e.key==='Escape') { closeModal(); closeDetailModal(); }
});