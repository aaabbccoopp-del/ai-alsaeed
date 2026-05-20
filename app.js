/* ═══════════════════════════════════════════════════
   السعيد AI — app.js  v3
   المطور: أحمد سعيد
   ═══════════════════════════════════════════════════ */
'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEV_NAME    = 'أحمد سعيد';
const DEV_PHONE   = '201090844039';
const WA_MSG      = encodeURIComponent('مرحباً أحمد سعيد، أنا مستخدم تطبيق السعيد AI وأريد التواصل معك.');
const WA_LINK     = `https://wa.me/${DEV_PHONE}?text=${WA_MSG}`;
const STORAGE_KEY = 'saeed_ai_sessions_v3';
const THEME_KEY   = 'saeed_ai_theme';
const AI_STREAM   = 'https://text.pollinations.ai/openai';

const SYSTEM_PROMPT = `أنت السعيد AI، مساعد ذكي وودود تتكلم بالعربية المصرية البسيطة بأسلوب حيوي ومرح.
استخدم الإيموجي بشكل طبيعي في ردودك 😊✨.
إذا سألك أحد عن اسمك قل: "أنا السعيد AI مساعدك الذكي!".
إذا سألك أحد من طورك أو من برمجك أو مين عملك قل: "طورني وبرمجني ${DEV_NAME} 👨‍💻".
إذا سألك أحد كيف يتواصل مع المطور قل: "هفتحلك واتساب المطور ${DEV_NAME} دلوقتي! 📱".
في وضع المكالمة الصوتية اجعل ردودك قصيرة وطبيعية كأنك في محادثة هاتفية.`;

const CONTACT_KEYWORDS = ['تواصل','واتساب','whatsapp','اتصل','ابعت','contact'];

// ─── State ────────────────────────────────────────────────────────────────────
let sessions     = loadSessions();
let activeId     = null;
let isLoading    = false;
let abortCtrl    = null;
let isListening  = false;
let recognition  = null;
let isSpeaking   = false;
let currentUtter = null;

// ── Call State ──
let callActive    = false;
let callMuted     = false;
let callTimerRef  = null;
let callSeconds   = 0;
let callRecog     = null;
let callMessages  = [];    // separate history for voice call
let callProcessing = false;

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);

const sidebarEl      = $('#sidebar');
const sidebarOverlay = $('#sidebarOverlay');
const sidebarClose   = $('#sidebarClose');
const btnMenuToggle  = $('#btnMenuToggle');
const btnNewChat     = $('#btnNewChat');
const sessionsList   = $('#sessionsList');
const sessionsEmpty  = $('#sessionsEmpty');
const messagesArea   = $('#messagesArea');
const welcomeScreen  = $('#welcomeScreen');
const messagesList   = $('#messagesList');
const userInput      = $('#userInput');
const btnSend        = $('#btnSend');
const btnMic         = $('#btnMic');
const headerTitle    = $('#headerTitle');
const btnTheme       = $('#btnTheme');
const iconTheme      = $('#iconTheme');
const waModal        = $('#waModal');
const waLink         = $('#waLink');
const waModalClose   = $('#waModalClose');
const quickPromptsEl = $('#quickPrompts');

// Call UI
const callOverlay    = $('#callOverlay');
const callStatus     = $('#callStatus');
const callTimerEl    = $('#callTimer');
const callWave       = $('#callWave');
const transcriptAI   = $('#transcriptAI');
const transcriptUser = $('#transcriptUser');
const callAvatar     = $('#callAvatar');
const btnCall        = $('#btnCall');
const btnVoiceCallBig= $('#btnVoiceCallBig');
const btnEndCall     = $('#btnEndCall');
const btnMute        = $('#btnMute');
const btnSpeaker     = $('#btnSpeaker');

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  renderSessionsList();
  bindEvents();
  autoResizeTextarea();
  waLink.href = WA_LINK;
  setTimeout(() => typeWelcomeText(), 300);
})();

// ─── Welcome Typing ───────────────────────────────────────────────────────────
function typeWelcomeText() {
  const el = $('#welcomeTitle');
  if (!el) return;
  const text = 'مرحباً! كيف يمكنني مساعدتك؟ 👋';
  el.textContent = '';
  let i = 0;
  const iv = setInterval(() => {
    if (i >= text.length) { clearInterval(iv); return; }
    el.textContent += text[i++];
  }, 40);
}

// ─── Storage ──────────────────────────────────────────────────────────────────
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveSessions() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(t) {
  document.body.classList.toggle('dark', t === 'dark');
  localStorage.setItem(THEME_KEY, t);
  iconTheme.innerHTML = t === 'dark'
    ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function openSidebar()  { sidebarEl.classList.add('open'); sidebarOverlay.classList.add('show'); }
function closeSidebar() { sidebarEl.classList.remove('open'); sidebarOverlay.classList.remove('show'); }

// ─── Sessions ─────────────────────────────────────────────────────────────────
function createSession() {
  const id = uid();
  sessions[id] = { id, title: 'محادثة جديدة', messages: [], createdAt: Date.now() };
  saveSessions();
  return id;
}
function deleteSession(id) {
  if (!confirm('حذف هذه المحادثة؟')) return;
  delete sessions[id];
  saveSessions();
  if (activeId === id) { activeId = null; showWelcome(); }
  renderSessionsList();
}
function loadSession(id) {
  if (!sessions[id]) return;
  activeId = id;
  headerTitle.textContent = sessions[id].title;
  renderMessages();
  renderSessionsList();
  closeSidebar();
}
function newChat() {
  activeId = null;
  headerTitle.textContent = 'السعيد AI';
  showWelcome();
  renderSessionsList();
  closeSidebar();
  userInput.focus();
}
function renderSessionsList() {
  const items = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);
  sessionsEmpty.style.display = items.length === 0 ? 'flex' : 'none';
  document.querySelectorAll('.session-item').forEach(el => el.remove());
  items.forEach(s => {
    const div = document.createElement('div');
    div.className = 'session-item' + (s.id === activeId ? ' active' : '');
    div.innerHTML = `
      <svg class="session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="session-title">${escHtml(s.title)}</span>
      <button class="session-del" title="حذف">✕</button>
    `;
    div.addEventListener('click', e => { if (!e.target.closest('.session-del')) loadSession(s.id); });
    div.querySelector('.session-del').addEventListener('click', e => { e.stopPropagation(); deleteSession(s.id); });
    sessionsList.appendChild(div);
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────
function showWelcome() {
  welcomeScreen.style.display = 'flex';
  messagesList.innerHTML = '';
  headerTitle.textContent = 'السعيد AI';
  setTimeout(() => typeWelcomeText(), 100);
}
function renderMessages() {
  const session = sessions[activeId];
  if (!session || !session.messages.length) { showWelcome(); return; }
  welcomeScreen.style.display = 'none';
  messagesList.innerHTML = '';
  session.messages.forEach(msg => appendBubble(msg));
  scrollToBottom();
}

function makeMsgAvatar(role) {
  if (role === 'user') {
    const d = document.createElement('div');
    d.className = 'msg-avatar-user';
    d.textContent = '👤';
    return d;
  }
  const d = document.createElement('div');
  d.className = 'msg-avatar';
  const img = document.createElement('img');
  img.src = 'avatar.png'; img.alt = 'AI';
  d.appendChild(img);
  return d;
}

function appendBubble(msg) {
  welcomeScreen.style.display = 'none';
  const row = document.createElement('div');
  row.className = `msg-row ${msg.role}`;
  row.dataset.id = msg.id;

  const content = msg.role === 'assistant' ? renderMarkdown(msg.content) : `<p>${escHtml(msg.content)}</p>`;
  const time = formatTime(msg.timestamp);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'msg-content';
  contentDiv.innerHTML = `
    <div class="msg-bubble">${content}</div>
    <div class="msg-actions">
      <button class="msg-act-btn copy-btn" data-text="${encodeURIComponent(msg.content)}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        نسخ
      </button>
      ${msg.role === 'assistant' ? `<button class="msg-act-btn speak-btn" data-text="${encodeURIComponent(msg.content)}">🔊 استمع</button>` : ''}
      <span class="msg-time">${time}</span>
    </div>
  `;

  contentDiv.querySelector('.copy-btn').addEventListener('click', function() {
    navigator.clipboard.writeText(decodeURIComponent(this.dataset.text)).then(() => {
      this.textContent = '✓ تم!';
      setTimeout(() => { this.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> نسخ`; }, 2000);
    });
  });
  contentDiv.querySelector('.speak-btn')?.addEventListener('click', function() {
    speakText(decodeURIComponent(this.dataset.text), this);
  });

  contentDiv.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = '📋 نسخ';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.querySelector('code')?.textContent || pre.textContent).then(() => {
        btn.textContent = '✓ تم!'; setTimeout(() => { btn.textContent = '📋 نسخ'; }, 2000);
      });
    });
    pre.appendChild(btn);
  });

  row.appendChild(makeMsgAvatar(msg.role));
  row.appendChild(contentDiv);
  messagesList.appendChild(row);
  scrollToBottom();
}

// ─── Streaming Bubble ──────────────────────────────────────────────────────────
function createStreamingBubble() {
  welcomeScreen.style.display = 'none';
  const row = document.createElement('div');
  row.className = 'msg-row ai'; row.id = 'streamRow';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'msg-content';
  contentDiv.innerHTML = `<div class="msg-bubble" id="streamBubble"><span class="cursor-blink">|</span></div>`;
  row.appendChild(makeMsgAvatar('assistant'));
  row.appendChild(contentDiv);
  messagesList.appendChild(row);
  scrollToBottom();
}
function updateStreamBubble(text) {
  const el = $('#streamBubble');
  if (el) { el.innerHTML = renderMarkdown(text) + '<span class="cursor-blink">|</span>'; scrollToBottom(); }
}
function finalizeStreamBubble(text, msgId) {
  const row = $('#streamRow');
  if (!row) return;
  row.id = ''; row.dataset.id = msgId;
  const bubble = row.querySelector('.msg-bubble');
  bubble.id = ''; bubble.innerHTML = renderMarkdown(text);

  const actions = document.createElement('div');
  actions.className = 'msg-actions';
  actions.innerHTML = `
    <button class="msg-act-btn copy-btn" data-text="${encodeURIComponent(text)}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> نسخ
    </button>
    <button class="msg-act-btn speak-btn" data-text="${encodeURIComponent(text)}">🔊 استمع</button>
    <span class="msg-time">${formatTime(Date.now())}</span>
  `;
  actions.querySelector('.copy-btn').addEventListener('click', function() {
    navigator.clipboard.writeText(decodeURIComponent(this.dataset.text)).then(() => {
      this.textContent = '✓ تم!'; setTimeout(() => { this.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> نسخ`; }, 2000);
    });
  });
  actions.querySelector('.speak-btn').addEventListener('click', function() {
    speakText(decodeURIComponent(this.dataset.text), this);
  });
  bubble.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn'; btn.textContent = '📋 نسخ';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.querySelector('code')?.textContent || pre.textContent).then(() => {
        btn.textContent = '✓ تم!'; setTimeout(() => { btn.textContent = '📋 نسخ'; }, 2000);
      });
    });
    pre.appendChild(btn);
  });
  row.querySelector('.msg-content').appendChild(actions);
}
function removeStreamBubble() { $('#streamRow')?.remove(); }
function scrollToBottom() { messagesArea.scrollTop = messagesArea.scrollHeight; }

// ─── Send Chat Message ─────────────────────────────────────────────────────────
async function sendMessage(customText) {
  const text = (customText ?? userInput.value).trim();
  if (!text || isLoading) return;

  const lower = text.toLowerCase();
  const isContactReq = CONTACT_KEYWORDS.some(kw => lower.includes(kw));

  if (!activeId) { activeId = createSession(); renderSessionsList(); }
  const session = sessions[activeId];

  userInput.value = ''; autoResizeTextarea();
  welcomeScreen.style.display = 'none';

  const userMsg = { id: uid(), role: 'user', content: text, timestamp: Date.now() };
  session.messages.push(userMsg);
  if (session.messages.length === 1) {
    session.title = text.slice(0, 32) + (text.length > 32 ? '…' : '');
    headerTitle.textContent = session.title;
  }
  saveSessions(); appendBubble(userMsg); renderSessionsList();

  isLoading = true; updateSendBtn(); createStreamingBubble();
  let fullText = '';

  try {
    abortCtrl = new AbortController();
    const res = await fetch(AI_STREAM, {
      method: 'POST', signal: abortCtrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai', stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...session.messages.slice(-14).map(m => ({ role: m.role, content: m.content }))
        ]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fullText = await readStream(res, updateStreamBubble);
    if (!fullText.trim()) fullText = '😕 لم أحصل على رد، حاول مرة أخرى!';
    const aiMsg = { id: uid(), role: 'assistant', content: fullText, timestamp: Date.now() };
    session.messages.push(aiMsg); saveSessions();
    finalizeStreamBubble(fullText, aiMsg.id);
    if (isContactReq) setTimeout(() => openWaModal(), 500);
  } catch (err) {
    removeStreamBubble();
    if (err.name !== 'AbortError') appendBubble({ id: uid(), role: 'assistant', content: '😕 في مشكلة في الاتصال، حاول تاني!', timestamp: Date.now() });
  } finally {
    isLoading = false; updateSendBtn();
  }
}

function stopGeneration() {
  abortCtrl?.abort(); removeStreamBubble(); isLoading = false; updateSendBtn();
}
function updateSendBtn() {
  btnSend.disabled = !isLoading && !userInput.value.trim();
  btnSend.classList.toggle('stop-btn', isLoading);
  btnSend.innerHTML = isLoading
    ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`
    : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
}

// ─── Stream reader ────────────────────────────────────────────────────────────
async function readStream(res, onChunk) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '', fullText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;
      try {
        const delta = JSON.parse(trimmed.slice(6)).choices?.[0]?.delta?.content || '';
        if (delta) { fullText += delta; onChunk(fullText); }
      } catch {}
    }
  }
  return fullText;
}

// ════════════════════════════════════════════════════
//  VOICE CALL SYSTEM
// ════════════════════════════════════════════════════

function startCall() {
  if (callActive) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('متصفحك لا يدعم التعرف على الكلام 🎤\nاستخدم Chrome أو Edge.'); return; }

  callActive = true;
  callMessages = [];
  callSeconds = 0;
  callProcessing = false;
  callOverlay.classList.add('active');
  setCallStatus('🔄 جاري الاتصال بالسعيد AI...');
  setWaveMode('idle');

  // Greet after short delay
  setTimeout(async () => {
    const greeting = 'أهلاً! أنا السعيد AI 😊 تكلم وأنا هرد عليك. قل "إنهاء" لإنهاء المكالمة.';
    setCallStatus('🤖 السعيد AI يتكلم...');
    setAITranscript(greeting);
    setWaveMode('speaking');
    animateCallAvatar(true);
    startCallTimer();
    await speakCallText(greeting);
    animateCallAvatar(false);
    if (callActive && !callMuted) startCallListening();
  }, 800);
}

function endCall() {
  callActive = false;
  stopCallTimer();
  stopCallListening();
  window.speechSynthesis?.cancel();
  callOverlay.classList.remove('active');
  setWaveMode('idle');
  animateCallAvatar(false);
  setCallStatus('جاري الاتصال...');
  setAITranscript(''); setUserTranscript('');
  callMessages = [];
}

function startCallListening() {
  if (!callActive || callMuted || callProcessing) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  stopCallListening();
  callRecog = new SR();
  callRecog.lang = 'ar-EG';
  callRecog.interimResults = true;
  callRecog.maxAlternatives = 1;
  callRecog.continuous = false;

  let interimText = '';

  callRecog.onstart = () => {
    setCallStatus('🎙️ تكلم الآن...');
    setWaveMode('listening');
    setCallRingsMode('user');
  };

  callRecog.onresult = (e) => {
    const results = Array.from(e.results);
    interimText = results.map(r => r[0].transcript).join('');
    setUserTranscript(interimText);
  };

  callRecog.onend = async () => {
    setWaveMode('idle');
    setCallRingsMode('ai');
    if (!callActive || callProcessing) return;
    const finalText = interimText.trim();
    if (!finalText) { if (callActive && !callMuted) setTimeout(() => startCallListening(), 500); return; }

    // Check for end call commands
    if (/إنهاء|أنهي|انهي|وداعاً|وداع|باي|bye|end call/i.test(finalText)) {
      setCallStatus('😊 إلى اللقاء! شكراً لك.');
      setAITranscript('إلى اللقاء! شكراً لتحدثك معي 😊');
      await speakCallText('إلى اللقاء! شكراً لتحدثك معي. دائماً في خدمتك!');
      setTimeout(() => endCall(), 800);
      return;
    }

    callProcessing = true;
    setCallStatus('⚡ جاري التفكير...');
    setWaveMode('idle');
    animateCallAvatar(false);

    try {
      callMessages.push({ role: 'user', content: finalText });
      const reply = await fetchAIForCall(callMessages.slice(-10));
      if (!callActive) return;
      callMessages.push({ role: 'assistant', content: reply });

      setAITranscript(reply);
      setCallStatus('🤖 السعيد AI يتكلم...');
      setWaveMode('speaking');
      animateCallAvatar(true);

      await speakCallText(reply);

      animateCallAvatar(false);
      setWaveMode('idle');
      if (callActive && !callMuted) setTimeout(() => startCallListening(), 300);
    } catch {
      setCallStatus('❌ حصل خطأ، حاول تاني...');
      if (callActive && !callMuted) setTimeout(() => startCallListening(), 1500);
    } finally {
      callProcessing = false;
    }
  };

  callRecog.onerror = (e) => {
    setWaveMode('idle');
    if (e.error === 'no-speech' && callActive && !callMuted) {
      setTimeout(() => startCallListening(), 600);
    }
  };

  try { callRecog.start(); } catch {}
}

function stopCallListening() {
  try { callRecog?.stop(); } catch {}
  callRecog = null;
}

async function fetchAIForCall(messages) {
  const res = await fetch(AI_STREAM, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai', stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\nأنت في مكالمة صوتية، اجعل ردودك قصيرة وطبيعية (2-3 جمل بحد أقصى).' },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await readStream(res, () => {});
}

function speakCallText(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();

    const cleanText = stripMarkdown(text);
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'ar-EG';
    utter.rate = 1.0;
    utter.pitch = 1.05;
    utter.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find(v => v.lang.startsWith('ar')) || voices.find(v => v.lang.includes('ar'));
    if (arVoice) utter.voice = arVoice;

    utter.onend  = resolve;
    utter.onerror = resolve;
    window.speechSynthesis.speak(utter);
  });
}

// ── Call UI helpers ───────────────────────────────────────────────────────────
function setCallStatus(txt) { callStatus.textContent = txt; }
function setAITranscript(txt) {
  if (!txt) { transcriptAI.textContent = ''; transcriptAI.classList.remove('show'); return; }
  transcriptAI.textContent = '🤖 ' + txt;
  transcriptAI.classList.add('show');
  callTranscriptScroll();
}
function setUserTranscript(txt) {
  if (!txt) { transcriptUser.textContent = ''; transcriptUser.classList.remove('show'); return; }
  transcriptUser.textContent = '👤 ' + txt;
  transcriptUser.classList.add('show');
  callTranscriptScroll();
}
function callTranscriptScroll() {
  const el = $('#callTranscript');
  if (el) el.scrollTop = el.scrollHeight;
}

function setWaveMode(mode) {
  callWave.classList.remove('listening', 'speaking', 'animate');
  if (mode === 'listening') { callWave.classList.add('listening', 'animate'); }
  if (mode === 'speaking')  { callWave.classList.add('speaking', 'animate'); }
}
function setCallRingsMode(who) {
  const rings = callOverlay.querySelectorAll('.call-ring');
  rings.forEach(r => {
    r.classList.remove('active-ring', 'user-speaking');
    if (who === 'user') r.classList.add('user-speaking');
    else if (who === 'ai') r.classList.add('active-ring');
  });
}
function animateCallAvatar(talking) {
  callAvatar.classList.toggle('ai-talking', talking);
}

function startCallTimer() {
  callSeconds = 0;
  clearInterval(callTimerRef);
  callTimerRef = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    const s = String(callSeconds % 60).padStart(2, '0');
    callTimerEl.textContent = `${m}:${s}`;
  }, 1000);
}
function stopCallTimer() {
  clearInterval(callTimerRef);
  callTimerEl.textContent = '00:00';
}

// ─── Text-to-Speech (chat messages) ──────────────────────────────────────────
function speakText(text, btn) {
  if (!window.speechSynthesis) { alert('المتصفح لا يدعم القراءة الصوتية'); return; }
  if (isSpeaking) {
    window.speechSynthesis.cancel(); isSpeaking = false;
    document.querySelectorAll('.speak-btn.speaking').forEach(b => { b.textContent = '🔊 استمع'; b.classList.remove('speaking'); });
    if (currentUtter?._btn === btn) return;
  }
  const utter = new SpeechSynthesisUtterance(stripMarkdown(text));
  utter._btn = btn; utter.lang = 'ar-EG'; utter.rate = 0.95; utter.pitch = 1.05;
  const voices = window.speechSynthesis.getVoices();
  const arVoice = voices.find(v => v.lang.startsWith('ar'));
  if (arVoice) utter.voice = arVoice;
  utter.onstart = () => { isSpeaking = true; btn.textContent = '⏹ إيقاف'; btn.classList.add('speaking'); };
  utter.onend = utter.onerror = () => { isSpeaking = false; btn.textContent = '🔊 استمع'; btn.classList.remove('speaking'); };
  currentUtter = utter;
  window.speechSynthesis.speak(utter);
}

// ─── Voice Input (text box mic) ───────────────────────────────────────────────
function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('المتصفح لا يدعم الإدخال الصوتي 🎤\nاستخدم Chrome أو Edge.'); return; }
  if (isListening) { recognition?.stop(); return; }
  recognition = new SR();
  recognition.lang = 'ar-EG'; recognition.interimResults = true;
  recognition.onresult = e => {
    const t = Array.from(e.results).map(r => r[0].transcript).join('');
    userInput.value = t; autoResizeTextarea(); updateSendBtn();
    if (e.results[e.results.length - 1].isFinal) { recognition.stop(); setTimeout(() => sendMessage(), 300); }
  };
  recognition.onstart  = () => { isListening = true;  btnMic.classList.add('listening'); };
  recognition.onend    = () => { isListening = false; btnMic.classList.remove('listening'); };
  recognition.onerror  = () => { isListening = false; btnMic.classList.remove('listening'); };
  recognition.start();
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
function autoResizeTextarea() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openWaModal()  { waModal.classList.add('show'); }
function closeWaModal() { waModal.classList.remove('show'); }

// ─── Markdown ─────────────────────────────────────────────────────────────────
function renderMarkdown(text) {
  let html = escHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const label = lang ? `<span class="code-lang">${escHtml(lang)}</span>` : '';
    return `<pre>${label}<code>${code.trim()}</code></pre>`;
  });
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  html = html.replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');
  html = html.replace(/(<oli>.*<\/oli>(\n|$))+/g, m =>
    `<ol>${m.replace(/<\/?oli>/g, t => t === '<oli>' ? '<li>' : '</li>')}</ol>`);
  html = html.split(/\n{2,}/).map(p => {
    if (/^<(h[123]|ul|ol|pre)/.test(p.trim())) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return html;
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,3} /g, '').replace(/`{1,3}[\s\S]*?`{1,3}/g, 'كود برمجي')
    .replace(/\n+/g, ' ').trim();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

// ─── Event Bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  btnMenuToggle.addEventListener('click', () => sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  btnNewChat.addEventListener('click', newChat);

  quickPromptsEl.addEventListener('click', e => {
    const btn = e.target.closest('.quick-btn');
    if (!btn) return;
    const p = btn.dataset.prompt;
    if (p === '__contact__') { openWaModal(); return; }
    sendMessage(p);
  });

  btnSend.addEventListener('click', () => isLoading ? stopGeneration() : sendMessage());
  userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isLoading) sendMessage(); }
  });
  userInput.addEventListener('input', () => { autoResizeTextarea(); updateSendBtn(); });
  btnMic.addEventListener('click', toggleVoice);
  btnTheme.addEventListener('click', () => applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));

  // Call buttons
  btnCall.addEventListener('click', startCall);
  btnVoiceCallBig?.addEventListener('click', startCall);
  btnEndCall.addEventListener('click', endCall);

  btnMute.addEventListener('click', () => {
    callMuted = !callMuted;
    btnMute.classList.toggle('muted', callMuted);
    btnMute.title = callMuted ? 'إلغاء الكتم' : 'كتم الميكروفون';
    if (callMuted) { stopCallListening(); setCallStatus('🔇 الميكروفون مكتوم'); setWaveMode('idle'); }
    else if (callActive && !callProcessing) { setTimeout(() => startCallListening(), 300); }
  });

  btnSpeaker.addEventListener('click', () => btnSpeaker.classList.toggle('active'));

  waModalClose.addEventListener('click', closeWaModal);
  waModal.addEventListener('click', e => { if (e.target === waModal) closeWaModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeWaModal(); if (callActive) endCall(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); newChat(); }
  });

  window.speechSynthesis?.addEventListener('voiceschanged', () => {});
  updateSendBtn();
}














// تسجيل الـ Service Worker لتفعيل الـ PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('تم تسجيل الـ Service Worker بنجاح!', reg))
      .catch(err => console.log('فشل تسجيل الـ Service Worker:', err));
  });
}
