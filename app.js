'use strict';

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

const images = { logo: null, themeImg: null, fbQr: null, lineQr: null };

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
  if (sp.pathwayCode) parts.push(sp.pathwayCode);
  if (sp.pathwayLevel) parts.push(sp.pathwayLevel);
  if (sp.pathwayProject) parts.push(sp.pathwayProject);
  if (parts.length) line += `\n [${parts.join(' - ')}]`;
  return line;
}

// ================================================================
// RIGHT PANEL BUILDER
// ================================================================
function buildRightPanel() {
  const pwList = PATHWAYS.map(([code, name]) =>
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
    <div class="rp-tr-title">Time Rules</div>
    <table class="rp-tr-table">
      <thead><tr><td></td><th class="tc-g">min</th><th class="tc-y">ok</th><th class="tc-r">max</th></tr></thead>
      <tbody>
        <tr><td class="tr-lbl">Prepared Speech</td><td class="tc-g">5</td><td class="tc-y">6</td><td class="tc-r">7</td></tr>
        <tr><td class="tr-lbl">Table Topic</td><td class="tc-g">1</td><td class="tc-y">1.5</td><td class="tc-r">2</td></tr>
        <tr><td class="tr-lbl">Evaluator</td><td class="tc-g">2</td><td class="tc-y">2.5</td><td class="tc-r">3</td></tr>
        <tr><td class="tr-lbl">LE&amp;GE</td><td class="tc-g">3</td><td class="tc-y">4</td><td class="tc-r">5</td></tr>
      </tbody>
    </table>
  </div>
  <div class="rp-qr-items">
    <div class="rp-qr-item">${fbContent}<div class="rp-qr-lbl">Follow us on FB!</div></div>
    <div class="rp-qr-item">${lineContent}<div class="rp-qr-lbl">Connect us with LINE@</div></div>
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
    <div class="club-name-en"><em>Entrepreneur Toastmasters Club</em></div>
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
    <div>⏰&ensp;<strong>Time : ${dateDisplay} ｜ 19:10 ~ 21:00</strong></div>
    <div>📅&ensp;Meeting on every 1<sup>st</sup> (中文) and 3<sup>rd</sup> (English) Tuesday evening</div>
    <div>📍&ensp;Venue: 鑫喜文創｜台北市信義區忠孝東路五段71巷11弄25號1樓<br>
    &emsp;&emsp;&emsp;（捷運板南線：市政府站4號出口，走路3分鐘）</div>
  </div>
</div>`;
}

// ================================================================
// AGENDA HTML GENERATOR
// ================================================================
function generateAgendaHTML(data) {
  const speechCount = data.speeches.length;
  // row count: reception(1)+opening(5)+speechBlock(1+N)+photo(1)+intermission(1)+topics(1)+spacer(1)+eval(8)+closing(2)+sharing(1)
  const totalRows = 22 + speechCount;

  const rightPanelHtml = buildRightPanel();
  const headerHtml = buildHeader(data);

  let tbody = '';

  // Reception — right panel cell starts here with rowspan
  tbody += `
  <tr>
    <td class="time-cell">18:50</td>
    <td class="dur-cell">20'</td>
    <td class="agenda-cell">Reception &amp; Social Gathering</td>
    <td class="taker-cell">${esc(data.receptionHost)}</td>
    <td class="rp-cell" rowspan="${totalRows}">${rightPanelHtml}</td>
  </tr>`;

  // Opening block (19:10, 10') — both time and dur rowspan 5
  tbody += `
  <tr>
    <td class="time-cell" rowspan="5">19:10</td>
    <td class="dur-cell" rowspan="5">10'</td>
    <td class="agenda-cell">1' Calling Meeting to Order</td>
    <td class="taker-cell">${esc(data.callingToOrder)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">2' Welcome Guests &amp; TME</td>
    <td class="taker-cell">${esc(data.welcomeTME)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">3' Toastmaster of The Evening</td>
    <td class="taker-cell">${esc(data.tme)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">2' Timer｜Meeting Rules Explanation</td>
    <td class="taker-cell">${esc(data.timer)}</td>
  </tr>
  <tr>
    <td class="agenda-cell">2' Ah-counter｜Meeting Rules Explanation</td>
    <td class="taker-cell">${esc(data.ahCounter)}</td>
  </tr>`;

  // Prepared Speech block — time rowspan = 1 + speechCount
  const speechBlockSpan = 1 + speechCount;
  tbody += `
  <tr class="row-section">
    <td class="time-cell" rowspan="${speechBlockSpan}">19:20</td>
    <td class="dur-cell">25'</td>
    <td class="agenda-cell"><strong>Prepared Speech</strong></td>
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
    <td class="time-cell">19:45</td>
    <td class="dur-cell">4'</td>
    <td class="agenda-cell">Group Photo</td>
    <td class="taker-cell">All Participants</td>
  </tr>`;

  // Intermission
  tbody += `
  <tr class="row-intermission">
    <td colspan="4">— Intermission &amp; Social Time (15 mins) —</td>
  </tr>`;

  // Table Topics
  tbody += `
  <tr class="row-section">
    <td class="time-cell">20:04</td>
    <td class="dur-cell">20'</td>
    <td class="agenda-cell"><strong>Table Topics Session</strong></td>
    <td class="taker-cell">${esc(data.tableTopicsMaster)}</td>
  </tr>`;

  // Spacer
  tbody += `<tr class="row-spacer"><td colspan="4"></td></tr>`;

  // Evaluation block — time rowspan 8
  tbody += `
  <tr class="row-section">
    <td class="time-cell" rowspan="8">20:24</td>
    <td class="dur-cell">25'</td>
    <td class="agenda-cell"><strong>Evaluation Session</strong></td>
    <td class="taker-cell">${esc(data.generalEvaluator)}</td>
  </tr>
  <tr>
    <td class="dur-cell">2'~3'</td>
    <td class="agenda-cell">Individual Evaluator for Speaker #1</td>
    <td class="taker-cell">${esc(data.evaluator1)}</td>
  </tr>
  <tr>
    <td class="dur-cell">2'~3'</td>
    <td class="agenda-cell">Individual Evaluator for Speaker #2</td>
    <td class="taker-cell">${esc(data.evaluator2)}</td>
  </tr>
  <tr>
    <td class="dur-cell">2'~3'</td>
    <td class="agenda-cell">Individual Evaluator for Speaker #3</td>
    <td class="taker-cell">${esc(data.evaluator3)}</td>
  </tr>
  <tr>
    <td class="dur-cell">1'</td>
    <td class="agenda-cell">Timer Report</td>
    <td class="taker-cell">${esc(data.timer)}</td>
  </tr>
  <tr>
    <td class="dur-cell">1'</td>
    <td class="agenda-cell">Ah-counter Report</td>
    <td class="taker-cell">${esc(data.ahCounter)}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'~5'</td>
    <td class="agenda-cell">Language Evaluation</td>
    <td class="taker-cell">${esc(data.langEvaluator)}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'~5'</td>
    <td class="agenda-cell">General Evaluation</td>
    <td class="taker-cell">${esc(data.generalEvaluator)}</td>
  </tr>`;

  // Closing — time rowspan 2
  tbody += `
  <tr>
    <td class="time-cell" rowspan="2">20:49</td>
    <td class="dur-cell">3'</td>
    <td class="agenda-cell">Toastmaster of the Evening</td>
    <td class="taker-cell">${esc(data.tme)}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'</td>
    <td class="agenda-cell">Awards Presentation</td>
    <td class="taker-cell">${esc(data.awardsPresenter)}</td>
  </tr>`;

  // Sharing & Feedback
  tbody += `
  <tr>
    <td class="time-cell">21:00</td>
    <td class="dur-cell">5'</td>
    <td class="agenda-cell">Sharing &amp; Feedback</td>
    <td class="taker-cell">${esc(data.sharingFeedback)}</td>
  </tr>`;

  return `
${headerHtml}

<div class="theme-row">
  <span class="theme-label">Meeting&nbsp;&nbsp;Theme:</span>
  <span class="theme-value"><strong><em>${esc(data.meetingTheme) || '—'}</em></strong></span>
  <span class="meeting-no-label">Meeting No.${esc(data.meetingNo)}</span>
</div>

<div class="mission-section">
  <div class="mission-title">— Mission of Toastmasters Club —</div>
  <div class="mission-text">"We provide a supportive and positive learning experience in which members are empowered to
develop communication and leadership skills, resulting in greater self-confidence and personal growth."</div>
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
      <th>Time</th>
      <th></th>
      <th>Agenda (Program)</th>
      <th>Assignment Taker</th>
      <th>⏱ Pathways</th>
    </tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>

<div class="agenda-footer">— Meeting Adjournment —</div>
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
    receptionHost:     val('receptionHost'),
    callingToOrder:    val('callingToOrder'),
    welcomeTME:        val('welcomeTME'),
    tme:               val('tme'),
    timer:             val('timer'),
    ahCounter:         val('ahCounter'),
    speeches:          speeches,
    tableTopicsMaster: val('tableTopicsMaster'),
    generalEvaluator:  val('generalEvaluator'),
    evaluator1:        val('evaluator1'),
    evaluator2:        val('evaluator2'),
    evaluator3:        val('evaluator3'),
    langEvaluator:     val('langEvaluator'),
    awardsPresenter:   val('awardsPresenter'),
    sharingFeedback:   val('sharingFeedback'),
  };
}

function updatePreview() {
  const data = collectData();
  document.getElementById('agendaPreview').innerHTML = generateAgendaHTML(data);
}

// ================================================================
// PDF DOWNLOAD
// ================================================================
function downloadPDF() {
  const data = collectData();
  const dateStr = formatDate(data.meetingDate) || 'agenda';

  // Use the already-rendered preview element directly so html2canvas can capture it
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
  speeches = [{ title: '', speaker: '', duration: "5'-7'", pathwayCode: '', pathwayLevel: '', pathwayProject: '' }];
  Object.keys(images).forEach(k => { images[k] = null; });
  renderSpeechForms();
}

function init() {
  // Default date: next 1st or 3rd Tuesday
  const today = new Date();
  let d = new Date(today);
  while (true) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 2) {
      const day = d.getDate();
      if (day <= 7 || (day >= 15 && day <= 21)) break;
    }
  }
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('meetingDate').value =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  renderSpeechForms();

  document.querySelector('.form-panel').addEventListener('input', updatePreview);
  document.querySelector('.form-panel').addEventListener('change', updatePreview);

  updatePreview();
}

document.addEventListener('DOMContentLoaded', init);
