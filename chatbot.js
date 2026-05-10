// ============================================================
//  chatbot.js — نفس كودك الأصلي + إدارة المهام عبر db.js
// ============================================================

const typing_form  = document.querySelector(".typing_form");
const chat_list    = document.querySelector(".chat_list");
const typing_input = document.querySelector(".typing_input");

const API_KEY = "AIzaSyDL1iEPjpZeG3KGTGe7YUBxjJsHsREHaKg";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

let userMessage = "";

// ============================================================
//  HELPERS — قراءة/حفظ المهام عبر db.js
// ============================================================
function loadTasks() {
    if (window.DB && typeof DB.getTasks === 'function') return DB.getTasks();
    try { return JSON.parse(localStorage.getItem('tasks_v3') || '[]'); } catch { return []; }
}

function saveTasks(arr) {
    if (window.DB && typeof DB.saveTasks === 'function') { DB.saveTasks(arr); return; }
    try { localStorage.setItem('tasks_v3', JSON.stringify(arr)); } catch (e) {}
}

function genCode() { return 'TM' + Math.random().toString(36).toUpperCase().slice(2, 8); }

// ============================================================
//  QUICK SEND
// ============================================================
function sendQuick(text) {
    typing_input.value = text;
    handleOutGoingChat();
}

// ============================================================
//  APPEND BOT MESSAGE
// ============================================================
function appendBotMessage(html) {
    const wrap = document.createElement('div');
    wrap.classList.add('messages');
    wrap.innerHTML = `
        <div class="messages_content bot-message">
            <img src="images/gemini.svg" alt="bot"
                 onerror="this.src='https://placehold.co/38x38/34a853/white?text=AI'">
            <div class="text">${html}</div>
        </div>
        <span class="copy-btn material-symbols-outlined">content_copy</span>`;
    chat_list.appendChild(wrap);
    chat_list.scrollTop = chat_list.scrollHeight;
}

// ============================================================
//  PROCESS TASK COMMANDS
//  يكشف أوامر المهام ويُنفّذها مباشرة بدون API
// ============================================================
function processTaskCommand(msg) {
    const m = msg.trim();

    // ── إضافة مهمة: "أضف مهمة: اسم المهمة" ──
    const addMatch = m.match(/^(?:أضف|اضف|ضيف|add)\s+(?:مهمة|مهمه|task)[:\s]+(.+)$/i);
    if (addMatch) {
        const name  = addMatch[1].trim();
        const tasks = loadTasks();
        const dl    = new Date(); dl.setDate(dl.getDate() + 7);
        const dlStr = dl.toISOString().split('T')[0];
        const task  = {
            id: Date.now(), name, desc: '',
            deadline: dlStr, period: 'week',
            priority: 'medium', done: false,
            date: Date.now(), attachments: []
        };
        tasks.push(task);
        saveTasks(tasks);
        appendBotMessage(`✅ تمت إضافة المهمة <strong>"${name}"</strong> بنجاح!<br>📅 موعد التسليم: ${formatDate(dlStr)}<br>🟡 الأولوية: متوسطة`);
        return true;
    }

    // ── إضافة بأولوية: "أضف مهمة عاجلة: اسم" ──
    const addUrgent = m.match(/^(?:أضف|اضف|ضيف)\s+مهمة\s+(?:عاجلة|مهمة|عاجل)[:\s]+(.+)$/i);
    if (addUrgent) {
        const name  = addUrgent[1].trim();
        const tasks = loadTasks();
        const dlStr = new Date().toISOString().split('T')[0];
        const task  = {
            id: Date.now(), name, desc: '',
            deadline: dlStr, period: 'today',
            priority: 'high', done: false,
            date: Date.now(), attachments: []
        };
        tasks.push(task);
        saveTasks(tasks);
        appendBotMessage(`✅ تمت إضافة المهمة العاجلة <strong>"${name}"</strong>!<br>📅 اليوم<br>🔴 الأولوية: عالية`);
        return true;
    }

    // ── حذف بالاسم: "احذف مهمة: اسم المهمة" ──
    const delName = m.match(/^(?:احذف|حذف|امسح|delete)\s+(?:مهمة|مهمه|task)[:\s]+(.+)$/i);
    if (delName) {
        const query = delName[1].trim().toLowerCase();
        let tasks   = loadTasks();
        const found = tasks.find(t => t.name.toLowerCase().includes(query));
        if (!found) {
            appendBotMessage(`❌ لم أجد مهمة تحتوي على <strong>"${delName[1].trim()}"</strong>`);
            return true;
        }
        tasks = tasks.filter(t => t.id !== found.id);
        saveTasks(tasks);
        appendBotMessage(`🗑 تم حذف المهمة <strong>"${found.name}"</strong> بنجاح.`);
        return true;
    }

    // ── حذف المكتملة ──
    if (/^(?:احذف|حذف|امسح)\s+(?:المهام\s+)?(?:المكتملة|المكتمله|المنتهية)$/i.test(m)) {
        let tasks = loadTasks();
        const count = tasks.filter(t => t.done).length;
        if (!count) { appendBotMessage('ℹ️ لا توجد مهام مكتملة لحذفها.'); return true; }
        saveTasks(tasks.filter(t => !t.done));
        appendBotMessage(`🗑 تم حذف <strong>${count}</strong> مهمة مكتملة ✨`);
        return true;
    }

    // ── تعديل اسم مهمة: "عدل مهمة: الاسم القديم / الاسم الجديد" ──
    const editName = m.match(/^(?:عدل|تعديل|عدّل|edit)\s+(?:مهمة|مهمه|task)[:\s]+(.+)\s*[\/\|]\s*(.+)$/i);
    if (editName) {
        const oldQ  = editName[1].trim().toLowerCase();
        const newN  = editName[2].trim();
        const tasks = loadTasks();
        const found = tasks.find(t => t.name.toLowerCase().includes(oldQ));
        if (!found) {
            appendBotMessage(`❌ لم أجد مهمة تحتوي على <strong>"${editName[1].trim()}"</strong>`);
            return true;
        }
        const oldName = found.name;
        found.name    = newN;
        saveTasks(tasks);
        appendBotMessage(`✏️ تم تعديل اسم المهمة:<br>من: <strong>${oldName}</strong><br>إلى: <strong>${newN}</strong>`);
        return true;
    }

    // ── تحديد كمكتملة: "اكملت مهمة: اسم" ──
    const doneMatch = m.match(/^(?:اكملت|أكملت|خلصت|انتهيت من)\s+(?:مهمة|مهمه)?[:\s]+(.+)$/i);
    if (doneMatch) {
        const query = doneMatch[1].trim().toLowerCase();
        const tasks = loadTasks();
        const found = tasks.find(t => t.name.toLowerCase().includes(query) && !t.done);
        if (!found) {
            appendBotMessage(`❌ لم أجد مهمة غير مكتملة باسم <strong>"${doneMatch[1].trim()}"</strong>`);
            return true;
        }
        found.done = true;
        saveTasks(tasks);
        appendBotMessage(`✅ تم تحديد المهمة <strong>"${found.name}"</strong> كمكتملة!`);
        return true;
    }

    // ── عرض المهام ──
    if (/(?:اعرض|اظهر|عرض|show|list)\s+(?:مهامي|مهام|tasks)/i.test(m)) {
        const tasks = loadTasks();
        if (!tasks.length) {
            appendBotMessage('📭 لا توجد مهام حالياً.<br>قل <strong>"أضف مهمة: اسم المهمة"</strong> لإضافة مهمة جديدة.');
            return true;
        }
        const done    = tasks.filter(t => t.done).length;
        const pending = tasks.filter(t => !t.done).length;
        const list    = tasks.map(t => {
            const icon = t.done ? '✅' : t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
            return `${icon} <strong>${t.name}</strong> — ${formatDate(t.deadline)}`;
        }).join('<br>');
        appendBotMessage(`📋 <strong>مهامك (${tasks.length}):</strong><br><br>${list}<br><br>✅ مكتملة: ${done} &nbsp; ⏳ معلقة: ${pending}`);
        return true;
    }

    // ── المهام المتأخرة ──
    if (/(?:متأخر|متأخرة|late|overdue)/.test(m)) {
        const tasks = loadTasks();
        const late  = tasks.filter(t => daysLeft(t.deadline) < 0 && !t.done);
        if (!late.length) { appendBotMessage('✅ لا توجد مهام متأخرة! أنت في الموعد.'); return true; }
        const list = late.map(t => `⚠️ <strong>${t.name}</strong> — متأخرة ${Math.abs(daysLeft(t.deadline))} يوم`).join('<br>');
        appendBotMessage(`⚠️ <strong>المهام المتأخرة (${late.length}):</strong><br><br>${list}`);
        return true;
    }

    return false; // ليس أمر مهام → أرسل للـ AI
}

// ============================================================
//  HELPERS
// ============================================================
function daysLeft(dl) {
    const t = new Date(); t.setHours(0,0,0,0);
    const d = new Date(dl); d.setHours(0,0,0,0);
    return Math.round((d-t)/86400000);
}
function formatDate(s) {
    return new Date(s).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
}

// ============================================================
//  SHOW TYPING EFFECT
// ============================================================
const showTypingEffect = (text, textElement, div) => {
    const words = text.split(" ");
    let currentWordIndex = 0;

    const typingInterval = setInterval(() => {
        textElement.innerHTML += (currentWordIndex !== 0 ? " " : "") + words[currentWordIndex++];
        if (currentWordIndex === words.length) {
            clearInterval(typingInterval);
            div.classList.remove("loading");
            chat_list.scrollTop = chat_list.scrollHeight;
        }
    }, 75);
};

// ============================================================
//  GENERATE API RESPONSE
// ============================================================
const generateAPIResponse = async (div) => {
    const textElement = div.querySelector(".text");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: userMessage }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || "خطأ غير معروف";
            console.error("API Error:", errMsg);
            textElement.innerHTML = `❌ ${errMsg}`;
            textElement.style.color = "#ef4444";
            return;
        }

        if (!data.candidates || data.candidates.length === 0) {
            console.error("No candidates:", data);
            textElement.innerHTML = "⚠️ لم يتم الحصول على رد، حاول مجدداً.";
            textElement.style.color = "#f59e0b";
            return;
        }

        const apiResponse = data.candidates[0]?.content?.parts[0]?.text
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        showTypingEffect(apiResponse, textElement, div);

    } catch (error) {
        console.error("Fetch Error:", error.message);
        textElement.innerHTML = `❌ ${error.message}`;
        textElement.style.color = "#ef4444";
        div.classList.remove("loading");
    }
};

// ============================================================
//  SHOW LOADING
// ============================================================
const showLoading = () => {
    const html = `
        <div class="messages_content bot-message">
            <img src="images/gemini.svg" alt="bot"
                 onerror="this.src='https://placehold.co/38x38/34a853/white?text=AI'">
            <div class="text">
                <div class="loading_indicoator">
                    <div class="loding__bar"></div>
                    <div class="loding__bar"></div>
                    <div class="loding__bar"></div>
                </div>
            </div>
        </div>
        <span class="copy-btn material-symbols-outlined">content_copy</span>
    `;

    const div = document.createElement("div");
    div.classList.add("messages", "loading");
    div.innerHTML = html;
    chat_list.appendChild(div);
    chat_list.scrollTop = chat_list.scrollHeight;

    generateAPIResponse(div);
};

// ============================================================
//  HANDLE OUTGOING CHAT
// ============================================================
const handleOutGoingChat = () => {
    userMessage = typing_input.value.trim();
    if (!userMessage) return;

    // رسالة المستخدم
    const html = `
        <div class="messages_content user-message">
            <img src="images/user.png" alt="user"
                onerror="this.src='https://placehold.co/38x38/4285f4/white?text=أ'">
            <p class="text">${userMessage}</p>
        </div>
    `;

    const div = document.createElement("div");
    div.classList.add("messages", "outgoing");
    div.innerHTML = html;
    chat_list.appendChild(div);
    chat_list.scrollTop = chat_list.scrollHeight;

    typing_form.reset();

    // إذا كان أمر مهام → نفّذه مباشرة بدون API
    if (processTaskCommand(userMessage)) return;

    // غير ذلك → أرسل للـ AI
    setTimeout(showLoading, 500);
};

// ============================================================
//  SUBMIT
// ============================================================
typing_form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleOutGoingChat();
});