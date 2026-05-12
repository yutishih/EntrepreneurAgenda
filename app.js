'use strict';

// ================================================================
// AUTH
// ================================================================
async function checkAuth() {
  const token = getToken();
  if (!token) { window.location.href = 'login.html'; return; }
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      document.querySelector('.app-layout').style.display = 'flex';
      const btn = document.getElementById('logoutBtn');
      if (btn) btn.textContent = `登出（${getUsername()}）`;
    } else {
      clearAuth();
      window.location.href = 'login.html';
    }
  } catch {
    clearAuth();
    window.location.href = 'login.html';
  }
}

function doLogout() {
  if (!confirm('確定要登出嗎？')) return;
  clearAuth();
  window.location.href = 'login.html';
}

// ================================================================
// CONSTANTS
// ================================================================
const PATHWAYS = [
  ['DL', 'Dynamic Leadership'],
  ['EH', 'Engaging Humor'],
  ['MS', 'Motivational Strategies'],
  ['PI', 'Persuasive Influence'],
  ['PM', 'Presentation Mastery'],
  ['VC', 'Visionary Communication'],
  ['EC', 'Effective Coaching'],
  ['IP', 'Innovative Planning'],
  ['SR', 'Strategic Relationships'],
  ['TC', 'Team Collaboration'],
  ['LD', 'Leadership Development'],
];

const PATHWAYS_ZH = [
  ['DL', '動態領導'],
  ['EH', '風趣表達'],
  ['MS', '激勵策略'],
  ['PI', '說服影響'],
  ['PM', '演講精粹'],
  ['VC', '願景溝通'],
  ['EC', '高效教練'],
  ['IP', '創新規劃'],
  ['SR', '策略人脈'],
  ['TC', '團隊合作'],
  ['LD', '領導力發展'],
];

const PATHWAY_OPTIONS = PATHWAYS.map(([code, name]) =>
  `<option value="${code}">${code} — ${name}</option>`
).join('');

// ================================================================
// STATE
// ================================================================
let speeches = [
  { title: 'TBD', speaker: '', duration: "5'-7'", pathwayCode: '', pathwayLevel: '', pathwayProject: '' },
  { title: '', speaker: '', duration: "5'-7'", pathwayCode: '', pathwayLevel: '', pathwayProject: '' },
  { title: '', speaker: '', duration: "5'-7'", pathwayCode: '', pathwayLevel: '', pathwayProject: '' },
];

let evaluators = ['', '', ''];

let lang = 'en';

const TRANSLATIONS = {
  en: {
    reception:      'Reception & Social Gathering',
    callingOrder:   "1' Calling Meeting to Order",
    welcomeGuests:  "2' Welcome Guests & TME",
    tmeIntro:       "3' Toastmaster of The Evening",
    timerExplain:   "2' Timer｜Meeting Rules Explanation",
    ahExplain:      "2' Ah-counter｜Meeting Rules Explanation",
    preparedSpeech: 'Prepared Speech',
    groupPhoto:     'Group Photo',
    allParticipants:'All Participants',
    intermission:   '— Intermission & Social Time (15 mins) —',
    tableTopics:    'Table Topics Session',
    evaluation:     'Evaluation Session',
    evaluatorFor:   n => `Individual Evaluator for Speaker #${n}`,
    timerReport:    'Timer Report',
    ahReport:       'Ah-counter Report',
    langEval:       'Language Evaluation',
    generalEval:    'General Evaluation',
    tmeClosing:     'Toastmaster of the Evening',
    awards:         'Awards Presentation',
    sharing:        'Sharing & Feedback',
    adjournment:    '— Meeting Adjournment —',
    thTime:         'Time',
    thAgenda:       'Agenda (Program)',
    thTaker:        'Assignment Taker',
    thPathways:     '⏱ Pathways',
    themeLabel:     'Meeting  Theme:',
    meetingNoLabel: n => `Meeting No.${n}`,
    missionTitle:   '— Mission of Toastmasters Club —',
    missionText:    '"We provide a supportive and positive learning experience in which members are empowered to develop communication and leadership skills, resulting in greater self-confidence and personal growth."',
    timeRules:      'Time Rules',
    trPrepared:     'Prepared Speech',
    trTopic:        'Table Topic',
    trEval:         'Evaluator',
    trLEGE:         'LE&GE',
    fbLabel:        'Follow us on FB!',
    lineLabel:      'Connect us with LINE@',
  },
  zh: {
    reception:      '報到 & 交誼',
    callingOrder:   "1' 宣布例會開始－領導宣讀宣言",
    welcomeGuests:  "2' 會長致歡迎詞",
    tmeIntro:       "3' 總主持人",
    timerExplain:   "2' 計時員",
    ahExplain:      "2' 贅語記錄員",
    preparedSpeech: '指定演講',
    groupPhoto:     '大合照',
    allParticipants:'所有與會者',
    intermission:   '✂ ——— 休息 & 交誼時間（10 分鐘）——— ✂',
    tableTopics:    '即席問答',
    evaluation:     '講評時間',
    evaluatorFor:   n => `個別講評員 #${n}`,
    timerReport:    '計時員報告',
    ahReport:       '贅語記錄員報告',
    langEval:       '語言講評',
    generalEval:    '總講評',
    tmeClosing:     '總主持人',
    awards:         '贈感謝狀',
    sharing:        '會後分享 & 來賓回饋',
    adjournment:    '——— 會議圓滿 ———',
    thTime:         '時間',
    thAgenda:       '議程表',
    thTaker:        '角色擔任',
    thPathways:     '⏱ 學習路徑',
    themeLabel:     '會議主題：',
    meetingNoLabel: n => `第 ${n} 次例會`,
    missionTitle:   '——— 演講會宗旨 ———',
    missionText:    '訓練溝通及領導能力，強調終身學習。參加國際演講協會是增進溝通技巧的最佳方法，除了大幅增加公開演講的自信外，在這裡所學到的領導技巧，更是您邁向成功之路的必備基石。',
    timeRules:      '時間規則',
    trPrepared:     '準備演講',
    trTopic:        '即席問答',
    trEval:         '個別講評',
    trLEGE:         '語言&總講評',
    fbLabel:        '追蹤我們的 FB！',
    lineLabel:      '加入企業家 LINE 群組！',
  },
};

function t(key, ...args) {
  const v = TRANSLATIONS[lang][key];
  return typeof v === 'function' ? v(...args) : v;
}

function toggleLang() {
  lang = lang === 'en' ? 'zh' : 'en';
  const btn = document.getElementById('langToggle');
  if (btn) btn.textContent = lang === 'en' ? '切換中文' : 'Switch to EN';
  updatePreview();
}

const timeOverrides = {
  openingStart: '',
  speechStart:  '',
  photoStart:   '',
  topicsStart:  '',
  evalStart:    '',
  closingStart: '',
  sharingStart: '',
};

const images = {
  logo:     'media/toastmasters_logo.png',
  themeImg: null,
  fbQr:     'media/FacebookQR.png',
  lineQr:   'media/LINEQR.png',
};

// ================================================================
// IMAGE HANDLING
// ================================================================
function handleImageUpload(key, input) {
  const file = input.files[0];
  if (!file) { images[key] = null; updatePreview(); return; }
  const reader = new FileReader();
  reader.onload = e => { images[key] = e.target.result; updatePreview(); };
  reader.readAsDataURL(file);
}

function clearImage(key) {
  images[key] = null;
  const inputId = 'img_' + key;
  const el = document.getElementById(inputId);
  if (el) el.value = '';
  updatePreview();
}

// ================================================================
// SPEECH FORM
// ================================================================
function renderSpeechForms() {
  const container = document.getElementById('speechesList');
  container.innerHTML = speeches.map((sp, i) => `
    <div class="speech-entry" id="speech-${i}">
      <div class="speech-entry-header">
        <span>演講 #${i + 1}</span>
        <button class="btn-remove" onclick="removeSpeech(${i})">✕ 移除</button>
      </div>
      <div class="form-row">
        <label>演講標題 Title</label>
        <textarea rows="2" oninput="updateSpeech(${i},'title',this.value)">${sp.title}</textarea>
      </div>
      <div class="form-row">
        <label>講者 Speaker (姓名 + 頭銜)</label>
        <input type="text" value="${sp.speaker}" oninput="updateSpeech(${i},'speaker',this.value)" placeholder="e.g. John Smith, TM">
      </div>
      <div class="form-row">
        <label>時長 Duration</label>
        <input type="text" value="${sp.duration}" oninput="updateSpeech(${i},'duration',this.value)" placeholder="5'-7'">
      </div>
      <div class="form-row">
        <label>學習路徑 Pathway</label>
        <select oninput="updateSpeech(${i},'pathwayCode',this.value)">
          <option value="">— 不指定 —</option>
          ${PATHWAY_OPTIONS}
        </select>
      </div>
      <div class="form-row">
        <label>等級 Level (e.g. L1P3)</label>
        <input type="text" value="${sp.pathwayLevel}" oninput="updateSpeech(${i},'pathwayLevel',this.value)" placeholder="L1P3">
      </div>
      <div class="form-row">
        <label>專案名稱 / 備註</label>
        <input type="text" value="${sp.pathwayProject}" oninput="updateSpeech(${i},'pathwayProject',this.value)" placeholder="Introduction to...">
      </div>
    </div>
  `).join('');

  speeches.forEach((sp, i) => {
    const sel = document.querySelector(`#speech-${i} select`);
    if (sel) sel.value = sp.pathwayCode || '';
  });

  renderEvaluatorForms();

  updatePreview();
}

function renderEvaluatorForms() {
  const container = document.getElementById('evaluatorsList');
  if (!container) return;
  container.innerHTML = evaluators.map((ev, i) => `
    <div class="speech-entry" style="padding:8px 10px">
      <div class="speech-entry-header">
        <span>講評 #${i + 1} <span class="time-hint">2'~3'</span></span>
        <button class="btn-remove" onclick="removeEvaluator(${i})">✕ 移除</button>
      </div>
      <div class="form-row" style="margin-bottom:0">
        <input type="text" value="${esc(ev)}"
               oninput="evaluators[${i}] = this.value; updatePreview()"
               placeholder="Name, Title">
      </div>
    </div>
  `).join('') + `<button class="btn-add" onclick="addEvaluator()">+ 新增講評</button>`;
}

function addEvaluator() {
  evaluators.push('');
  renderEvaluatorForms();
  updatePreview();
}

function removeEvaluator(i) {
  evaluators.splice(i, 1);
  renderEvaluatorForms();
  updatePreview();
}

function addSpeech() {
  speeches.push({ title: '', speaker: '', duration: "5'-7'", pathwayCode: '', pathwayLevel: '', pathwayProject: '' });
  renderSpeechForms();
}

function removeSpeech(i) {
  speeches.splice(i, 1);
  renderSpeechForms();
}

function updateSpeech(i, key, val) {
  speeches[i][key] = val;
  updatePreview();
}

// ================================================================
// TIME HELPERS
// ================================================================
function parseDurationMax(str) {
  const nums = (str || '').match(/\d+/g);
  if (!nums || !nums.length) return 7;
  return Math.max(...nums.map(Number));
}

function timeToMins(str) {
  const parts = (str || '0:0').split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMins(timeStr, delta) {
  return minsToTime(timeToMins(timeStr) + delta);
}

function calcTimes(spList) {
  const ov = timeOverrides;
  const valid = s => /^\d{1,2}:\d{2}$/.test((s || '').trim());
  const get   = (key, auto) => valid(ov[key]) ? ov[key].trim() : auto;

  const openingStart = get('openingStart', '19:10');
  const speechStart  = get('speechStart',  addMins(openingStart, 10));

  // speech block: sum of max durations + 4 min transition buffer
  const speechMins = spList.reduce((s, sp) => s + parseDurationMax(sp.duration), 0) + 4;
  const photoStart   = get('photoStart',   addMins(speechStart, speechMins));
  // photo (4') + intermission (15') = 19 min to table topics
  const topicsStart  = get('topicsStart',  addMins(photoStart,  19));
  const evalStart    = get('evalStart',    addMins(topicsStart, 20));
  // eval: 3' per evaluator + timer(1) + ah(1) + LE(5) + GE(5)
  const evalMins     = evaluators.length * 3 + 12;
  const closingStart = get('closingStart', addMins(evalStart,   evalMins));
  // closing: TME(3') + awards(3') = 6 min
  const sharingStart = get('sharingStart', addMins(closingStart, 6));

  return { openingStart, speechStart, photoStart, topicsStart, evalStart, closingStart, sharingStart };
}

function updateTimeOverride(key, value) {
  timeOverrides[key] = value;
  updatePreview();
}

function resetTimeOverride(key) {
  timeOverrides[key] = '';
  const el = document.getElementById(`to_${key}`);
  if (el) el.value = '';
  updatePreview();
}

function refreshAutoHints() {
  const times = calcTimes(speeches);
  [
    ['openingStart', times.openingStart],
    ['speechStart',  times.speechStart],
    ['photoStart',   times.photoStart],
    ['topicsStart',  times.topicsStart],
    ['evalStart',    times.evalStart],
    ['closingStart', times.closingStart],
    ['sharingStart', times.sharingStart],
  ].forEach(([key, val]) => {
    const el = document.getElementById(`auto_${key}`);
    if (el) el.textContent = `自動: ${val}`;
    // highlight override inputs that are active
    const input = document.getElementById(`to_${key}`);
    if (input) input.classList.toggle('is-overridden', !!timeOverrides[key].trim());
  });
}

// ================================================================
// HELPERS
// ================================================================
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSpeechAgendaLine(sp) {
  let line = esc(sp.title) || 'TBD';
  const parts = [];
  if (sp.pathwayCode)    parts.push(sp.pathwayCode);
  if (sp.pathwayLevel)   parts.push(sp.pathwayLevel);
  if (sp.pathwayProject) parts.push(sp.pathwayProject);
  if (parts.length) line += `\n [${parts.join(' - ')}]`;
  return line;
}

// ================================================================
// RIGHT PANEL BUILDER
// ================================================================
function buildRightPanel() {
  const pwSource = lang === 'zh' ? PATHWAYS_ZH : PATHWAYS;
  const pwList = pwSource.map(([code, name]) =>
    `<div class="rp-pw"><span class="rp-pwc">${esc(code)}｜</span><em class="rp-pwn">${esc(name)}</em></div>`
  ).join('');

  const fbContent = images.fbQr
    ? `<img src="${images.fbQr}" class="qr-img" alt="FB QR">`
    : `<div class="qr-ph"></div>`;
  const lineContent = images.lineQr
    ? `<img src="${images.lineQr}" class="qr-img" alt="LINE QR">`
    : `<div class="qr-ph"></div>`;

  return `<div class="rp-wrap">
  <div class="rp-pw-list">${pwList}</div>
  <div class="rp-tr">
    <div class="rp-tr-title">${t('timeRules')}</div>
    <table class="rp-tr-table">
      <thead><tr><td></td><th class="tc-g">min</th><th class="tc-y">ok</th><th class="tc-r">max</th></tr></thead>
      <tbody>
        <tr><td class="tr-lbl">${t('trPrepared')}</td><td class="tc-g">5</td><td class="tc-y">6</td><td class="tc-r">7</td></tr>
        <tr><td class="tr-lbl">${t('trTopic')}</td><td class="tc-g">1</td><td class="tc-y">1.5</td><td class="tc-r">2</td></tr>
        <tr><td class="tr-lbl">${t('trEval')}</td><td class="tc-g">2</td><td class="tc-y">2.5</td><td class="tc-r">3</td></tr>
        <tr><td class="tr-lbl">${t('trLEGE')}</td><td class="tc-g">3</td><td class="tc-y">4</td><td class="tc-r">5</td></tr>
      </tbody>
    </table>
  </div>
  <div class="rp-qr-items">
    <div class="rp-qr-item">${fbContent}<div class="rp-qr-lbl">${t('fbLabel')}</div></div>
    <div class="rp-qr-item">${lineContent}<div class="rp-qr-lbl">${t('lineLabel')}</div></div>
  </div>
</div>`;
}

// ================================================================
// HEADER BUILDER
// ================================================================
function buildHeader(data) {
  const dateDisplay = data.meetingDate ? formatDate(data.meetingDate) : '____.__.__';

  const logoHtml = images.logo
    ? `<img src="${images.logo}" class="hg-logo-img" alt="TM Logo">`
    : `<div class="hg-logo-ph"><div class="logo-ring"><span>TM</span></div></div>`;

  const themeImgHtml = images.themeImg
    ? `<img src="${images.themeImg}" class="hg-theme-img" alt="Theme">`
    : `<div class="hg-theme-ph"><span>Theme<br>Image</span></div>`;

  return `<div class="doc-header">
  <div class="hg-logo">${logoHtml}</div>
  <div class="hg-names">
    <div class="club-name-zh">企業家國際演講會</div>
    <div class="club-name-en">Entrepreneur Toastmasters Club</div>
  </div>
  <div class="hg-img">${themeImgHtml}</div>
  <div class="hg-meta-left">
    <div>No. 4069930</div>
    <div>Founded Since:</div>
    <div>2014.06.29</div>
    <div>&nbsp;</div>
    <div>Fee : NTD150</div>
  </div>
  <div class="hg-meta-right">
    <span class="hmr-icon">⏰</span><div class="hmr-text"><strong>Time : ${dateDisplay} ｜ ${esc(data.timeRange)}</strong></div>
    <span class="hmr-icon">📅</span><div class="hmr-text">${esc(data.meetingSchedule).replace(/\n/g, '<br>')}</div>
    <span class="hmr-icon">📍</span><div class="hmr-text">${esc(data.venueInfo).replace(/\n/g, '<br>')}</div>
  </div>
</div>`;
}

// ================================================================
// AGENDA HTML GENERATOR
// ================================================================
function generateAgendaHTML(data) {
  const speechCount = data.speeches.length;
  const evalCount   = data.evaluators.length;
  const times = calcTimes(data.speeches);

  // rows: reception(1) + opening(5) + speech_header(1) + speeches(N)
  //       + photo(1) + intermission(1) + topics(1) + spacer(1)
  //       + eval_header(1) + evaluators(M) + timer(1) + ah(1) + LE(1) + GE(1)
  //       + closing(2) + sharing(1)  = 19 + N + M
  const totalRows = 19 + speechCount + evalCount;

  const rightPanelHtml = buildRightPanel();
  const headerHtml = buildHeader(data);

  let tbody = '';

  // Reception — right panel cell starts here with rowspan
  tbody += `
  <tr>
    <td class="time-cell">18:50</td>
    <td class="dur-cell">20'</td>
    <td class="agenda-cell">${t('reception')}</td>
    <td class="taker-cell">${esc(data.receptionHost)}</td>
    <td class="rp-cell" rowspan="${totalRows}">${rightPanelHtml}</td>
  </tr>`;

  // Opening block — time & dur rowspan 5
  tbody += `
  <tr>
    <td class="time-cell" rowspan="5">${times.openingStart}</td>
    <td class="dur-cell" rowspan="5">10'</td>
    <td class="agenda-cell">${t('callingOrder')}</td>
    <td class="taker-cell">${esc(data.callingToOrder)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('welcomeGuests')}</td>
    <td class="taker-cell">${esc(data.welcomeTME)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('tmeIntro')}</td>
    <td class="taker-cell">${esc(data.tme)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('timerExplain')}</td>
    <td class="taker-cell">${esc(data.timer)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('ahExplain')}</td>
    <td class="taker-cell">${esc(data.ahCounter)}</td>
  </tr>`;

  // Prepared Speech block — time rowspan = 1 + speechCount
  const speechBlockSpan = 1 + speechCount;
  tbody += `
  <tr class="row-section">
    <td class="time-cell" rowspan="${speechBlockSpan}">${times.speechStart}</td>
    <td class="dur-cell">25'</td>
    <td class="agenda-cell"><strong>${t('preparedSpeech')}</strong></td>
    <td class="taker-cell">${esc(data.tme)}</td>
  </tr>`;

  data.speeches.forEach(sp => {
    tbody += `
  <tr>
    <td class="dur-cell">${esc(sp.duration || "5'-7'")}</td>
    <td class="agenda-cell">${buildSpeechAgendaLine(sp)}</td>
    <td class="taker-cell">${esc(sp.speaker)}</td>
  </tr>`;
  });

  // Group Photo
  tbody += `
  <tr>
    <td class="time-cell">${times.photoStart}</td>
    <td class="dur-cell">4'</td>
    <td class="agenda-cell">${t('groupPhoto')}</td>
    <td class="taker-cell">${t('allParticipants')}</td>
  </tr>`;

  // Intermission
  tbody += `
  <tr class="row-intermission">
    <td colspan="4">${t('intermission')}</td>
  </tr>`;

  // Table Topics
  tbody += `
  <tr class="row-section">
    <td class="time-cell">${times.topicsStart}</td>
    <td class="dur-cell">20'</td>
    <td class="agenda-cell"><strong>${t('tableTopics')}</strong></td>
    <td class="taker-cell">${esc(data.tableTopicsMaster)}</td>
  </tr>`;

  // Spacer
  tbody += `<tr class="row-spacer"><td colspan="4"></td></tr>`;

  // Evaluation block — rowspan = 1 (header) + M (evaluators) + 4 (timer, ah, LE, GE)
  const evalRowSpan = evalCount + 5;
  tbody += `
  <tr class="row-section">
    <td class="time-cell" rowspan="${evalRowSpan}">${times.evalStart}</td>
    <td class="dur-cell">25'</td>
    <td class="agenda-cell"><strong>${t('evaluation')}</strong></td>
    <td class="taker-cell">${esc(data.generalEvaluator)}</td>
  </tr>`;

  data.evaluators.forEach((ev, i) => {
    tbody += `
  <tr>
    <td class="dur-cell">2'~3'</td>
    <td class="agenda-cell">${t('evaluatorFor', i + 1)}</td>
    <td class="taker-cell">${esc(ev)}</td>
  </tr>`;
  });

  tbody += `
  <tr>
    <td class="dur-cell">1'</td>
    <td class="agenda-cell">${t('timerReport')}</td>
    <td class="taker-cell">${esc(data.timer)}</td>
  </tr>
  <tr>
    <td class="dur-cell">1'</td>
    <td class="agenda-cell">${t('ahReport')}</td>
    <td class="taker-cell">${esc(data.ahCounter)}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'~5'</td>
    <td class="agenda-cell">${t('langEval')}</td>
    <td class="taker-cell">${esc(data.langEvaluator)}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'~5'</td>
    <td class="agenda-cell">${t('generalEval')}</td>
    <td class="taker-cell">${esc(data.generalEvaluator)}</td>
  </tr>`;

  // Closing — time rowspan 2
  tbody += `
  <tr>
    <td class="time-cell" rowspan="2">${times.closingStart}</td>
    <td class="dur-cell">3'</td>
    <td class="agenda-cell">${t('tmeClosing')}</td>
    <td class="taker-cell">${esc(data.tme)}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'</td>
    <td class="agenda-cell">${t('awards')}</td>
    <td class="taker-cell">${esc(data.awardsPresenter)}</td>
  </tr>`;

  // Sharing & Feedback
  tbody += `
  <tr>
    <td class="time-cell">${times.sharingStart}</td>
    <td class="dur-cell">5'</td>
    <td class="agenda-cell">${t('sharing')}</td>
    <td class="taker-cell">${esc(data.sharingFeedback)}</td>
  </tr>`;

  return `
${headerHtml}

<div class="theme-row">
  <span class="theme-label">${t('themeLabel')}</span>
  <span class="theme-value"><strong><em>${esc(data.meetingTheme) || '—'}</em></strong></span>
  <span class="meeting-no-label">${t('meetingNoLabel', data.meetingNo)}</span>
</div>

<div class="mission-section">
  <div class="mission-title">${t('missionTitle')}</div>
  <div class="mission-text">${t('missionText')}</div>
</div>

<table class="agenda-table">
  <colgroup>
    <col class="col-time">
    <col class="col-dur">
    <col class="col-agenda">
    <col class="col-taker">
    <col class="col-rp">
  </colgroup>
  <thead>
    <tr>
      <th>${t('thTime')}</th>
      <th></th>
      <th>${t('thAgenda')}</th>
      <th>${t('thTaker')}</th>
      <th>${t('thPathways')}</th>
    </tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>

<div class="agenda-footer">${t('adjournment')}</div>
`;
}

// ================================================================
// PREVIEW
// ================================================================
function collectData() {
  return {
    meetingDate:       val('meetingDate'),
    meetingNo:         val('meetingNo'),
    meetingTheme:      val('meetingTheme'),
    timeRange:         val('timeRange'),
    meetingSchedule:   val('meetingSchedule'),
    venueInfo:         val('venueInfo'),
    receptionHost:     val('receptionHost'),
    callingToOrder:    val('callingToOrder'),
    welcomeTME:        val('welcomeTME'),
    tme:               val('tme'),
    timer:             val('timer'),
    ahCounter:         val('ahCounter'),
    speeches:          speeches,
    evaluators:        evaluators.slice(),
    tableTopicsMaster: val('tableTopicsMaster'),
    generalEvaluator:  val('generalEvaluator'),
    langEvaluator:     val('langEvaluator'),
    awardsPresenter:   val('awardsPresenter'),
    sharingFeedback:   val('sharingFeedback'),
  };
}

function equalizeRowHeights() {
  const table = document.querySelector('#agendaPreview .agenda-table');
  if (!table) return;
  const rows = [...table.querySelectorAll('tbody tr')];
  if (!rows.length) return;

  const extra = table.offsetHeight - rows.reduce((sum, tr) => sum + tr.offsetHeight, 0);
  if (extra <= 0) return;

  const addPerRow = extra / rows.length;
  rows.forEach(tr => { tr.style.height = (tr.offsetHeight + addPerRow) + 'px'; });
}

function updatePreview() {
  const data = collectData();
  document.getElementById('agendaPreview').innerHTML = generateAgendaHTML(data);
  requestAnimationFrame(equalizeRowHeights);
  refreshAutoHints();
  setSaveStatus('unsaved');
}

// ================================================================
// SAVE / LOAD
// ================================================================
let currentAgendaId = null;

function collectSaveData() {
  return { ...collectData(), timeOverrides: { ...timeOverrides } };
}

function applyAgendaData(d) {
  const fields = [
    'meetingDate', 'meetingNo', 'meetingTheme',
    'timeRange', 'meetingSchedule', 'venueInfo',
    'receptionHost', 'callingToOrder', 'welcomeTME', 'tme', 'timer', 'ahCounter',
    'tableTopicsMaster', 'generalEvaluator', 'langEvaluator',
    'awardsPresenter', 'sharingFeedback',
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = d[id] || '';
  });

  speeches   = d.speeches   || [];
  evaluators = d.evaluators || [];

  if (d.timeOverrides) {
    Object.assign(timeOverrides, d.timeOverrides);
    Object.entries(timeOverrides).forEach(([key, val]) => {
      const el = document.getElementById(`to_${key}`);
      if (el) el.value = val || '';
    });
  }

  renderSpeechForms();
  renderEvaluatorForms();
  updatePreview();
}

async function saveAgenda() {
  const btn = document.getElementById('btnSave');
  btn.disabled = true;
  btn.textContent = '儲存中...';
  try {
    const body = JSON.stringify({ data: collectSaveData() });
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    };
    let res;
    if (currentAgendaId) {
      res = await fetch(`${API_BASE}/api/agendas/${currentAgendaId}`, { method: 'PUT', headers, body });
    } else {
      res = await fetch(`${API_BASE}/api/agendas`, { method: 'POST', headers, body });
      if (res.ok) {
        const json = await res.json();
        currentAgendaId = json.id;
      }
    }
    if (!res.ok) throw new Error((await res.json()).detail || '儲存失敗');
    setSaveStatus('saved');
    btn.textContent = '✓ 已儲存';
    setTimeout(() => { btn.textContent = '💾 儲存'; }, 2000);
  } catch (e) {
    alert(e.message);
    btn.textContent = '💾 儲存';
  } finally {
    btn.disabled = false;
  }
}

async function openLoadModal() {
  document.getElementById('loadModal').style.display = 'flex';
  document.getElementById('agendaDateFilter').value = '';
  await fetchAgendaList('');
}

async function fetchAgendaList(date) {
  const list = document.getElementById('agendaListBody');
  list.innerHTML = '<p class="agenda-list-empty">載入中...</p>';
  try {
    const url = date ? `${API_BASE}/api/agendas?date=${date}&limit=100` : `${API_BASE}/api/agendas?limit=100`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('無法取得列表');
    const { items } = await res.json();
    if (!items.length) {
      list.innerHTML = '<p class="agenda-list-empty">找不到符合的議程</p>';
      return;
    }
    list.innerHTML = items.map(item => {
      const label = [
        item.meetingDate || '—',
        item.meetingNo   ? `No.${item.meetingNo}` : '',
        item.meetingTheme || '',
      ].filter(Boolean).join('  ·  ');
      const ts = item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-TW') : '';
      return `
        <div class="agenda-list-item" onclick="loadAgenda(${item.id})">
          <div class="ali-main">${label}</div>
          <div class="ali-meta">${ts}</div>
          <button class="ali-del" onclick="event.stopPropagation(); deleteAgenda(${item.id}, this)">🗑</button>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<p class="agenda-list-empty">${e.message}</p>`;
  }
}

function closeLoadModal() {
  document.getElementById('loadModal').style.display = 'none';
}

async function loadAgenda(id) {
  try {
    const res = await fetch(`${API_BASE}/api/agendas/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('載入失敗');
    const data = await res.json();
    applyAgendaData(data);
    currentAgendaId = id;
    setSaveStatus('saved');
    closeLoadModal();
  } catch (e) {
    alert(e.message);
  }
}

async function deleteAgenda(id, btn) {
  if (!confirm('確定要刪除這份議程嗎？')) return;
  try {
    const res = await fetch(`${API_BASE}/api/agendas/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('刪除失敗');
    if (currentAgendaId === id) { currentAgendaId = null; setSaveStatus('unsaved'); }
    btn.closest('.agenda-list-item').remove();
  } catch (e) {
    alert(e.message);
  }
}

function setSaveStatus(state) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  if (state === 'saved') {
    el.textContent = '● 已儲存';
    el.className = 'save-status saved';
  } else {
    el.textContent = '○ 未儲存';
    el.className = 'save-status unsaved';
  }
}

// ================================================================
// PDF DOWNLOAD
// ================================================================
function downloadPDF() {
  const data = collectData();
  const dateStr = formatDate(data.meetingDate) || 'agenda';

  const element = document.getElementById('agendaPreview');

  const opt = {
    margin:      [8, 8, 8, 8],
    filename:    `Agenda_${dateStr}_No${data.meetingNo || ''}.pdf`,
    image:       { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  html2pdf().set(opt).from(element).save();
}

// ================================================================
// RESET & INIT
// ================================================================
function resetForm() {
  if (!confirm('確定要清除所有資料嗎？')) return;
  document.querySelectorAll('.form-panel input[type="text"], .form-panel input[type="number"], .form-panel input[type="date"], .form-panel select, .form-panel textarea')
    .forEach(el => {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
  speeches   = [{ title: '', speaker: '', duration: "5'-7'", pathwayCode: '', pathwayLevel: '', pathwayProject: '' }];
  evaluators = [];
  Object.keys(timeOverrides).forEach(k => { timeOverrides[k] = ''; });
  Object.keys(images).forEach(k => { images[k] = null; });
  currentAgendaId = null;
  renderSpeechForms();
}

async function init() {
  await checkAuth();

  // 若 URL 帶 ?id=xxx，直接載入該議程；否則設預設日期
  const urlId = new URLSearchParams(window.location.search).get('id');
  if (urlId) {
    await loadAgenda(parseInt(urlId));
  } else {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('meetingDate').value =
      `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    document.getElementById('timeRange').value        = '19:10 ~ 21:00';
    document.getElementById('meetingSchedule').value  = 'Meeting on every 1st (中文) and 3rd (English) Tuesday evening';
    document.getElementById('venueInfo').value        = 'Venue: 鑫喜文創｜台北市信義區忠孝東路五段71巷11弄25號1樓\n（捷運板南線：市政府站4號出口，走路3分鐘）';

    renderSpeechForms();
  }

  document.querySelector('.form-panel').addEventListener('input', updatePreview);
  document.querySelector('.form-panel').addEventListener('change', updatePreview);

  updatePreview();
}

document.addEventListener('DOMContentLoaded', init);
