'use strict';

// ================================================================
// AGENDA TEMPLATE ENGINE
// ----------------------------------------------------------------
// Each template exposes:
//   key    — must match clubs.template_key
//   label  — shown in the club-management template picker
//   render(data, club, ctx) → HTML string for #agendaPreview
//
// `club`  is the active club's branding object (or null → use defaults).
// `ctx`   bundles shared helpers/globals injected by app.js (buildRenderCtx),
//         so templates never reach into app.js internals directly.
//
// To add a new layout: add an entry here + namespace its CSS under
// `.tmpl-<key>` in style.css. No app.js changes required.
// ================================================================

// ----------------------------------------------------------------
// Per-template default assets / values — the single source of truth for
// fallbacks used when a club hasn't uploaded/filled its own. Consumed by:
//   • this file's render()s            (bundled image fallbacks)
//   • app.js   applyClubImages / applyDefaultState
//   • club.html 版型設定 modal previews
// assetDefaults keys mirror the club fields (logo_url, fb_qr_url, …).
// ----------------------------------------------------------------
const STANDARD_ASSETS = {
  logo_url:    'media/toastmasters_logo.png',
  fb_qr_url:   'media/Entrepreneur/FacebookQR.png',
  line_qr_url: 'media/Entrepreneur/LINEQR.png',
};
const STANDARD_FIELD_DEFAULTS = {
  timeRange: '19:10 ~ 21:00',
  venue:     'Venue: 鑫喜文創｜台北市信義區忠孝東路五段71巷11弄25號1樓\n（捷運板南線：市政府站4號出口，走路3分鐘）',
};
const CHH_ASSETS = {
  logo_url:       'media/ChillHiHigh/chh-logo.png',
  fb_qr_url:      'media/ChillHiHigh/chh-facebook.png',
  line_qr_url:    'media/ChillHiHigh/chh-line.png',
  ig_qr_url:      'media/ChillHiHigh/chh-instagram.png',
  page2_hero_url: 'media/ChillHiHigh/chh-p2-1.png',
  page2_img2_url: 'media/ChillHiHigh/chh-p2-2.png',
};
const CHH_FIELD_DEFAULTS = {
  venue: '社會創新實驗中心 (臺北市大安區仁愛路三段 99 號) 107 會議室',
};

const AGENDA_TEMPLATES = {
  // --------------------------------------------------------------
  // STANDARD — the original Entrepreneur Toastmasters layout.
  // Branding text falls back to the historic hard-coded values when a
  // club has no branding set, so existing agendas render identically.
  // --------------------------------------------------------------
  standard: {
    key: 'standard',
    label: '標準版（企業家）',
    langToggle: true,        // offers a 中/英 switch
    assetDefaults: STANDARD_ASSETS,
    fieldDefaults: STANDARD_FIELD_DEFAULTS,
    // Manifest of this template's club-editable fields. Drives the 版型設定
    // modal (rendering, populate, save) in club.html — declare a field once here.
    //   store: 'column' (top-level club field) | 'setting' (settings JSON)
    //   group: 'basic' (編輯) | 'template' (版型)   row: pair fields in a 2-col grid
    settings: [
      { key:'fb_qr_url',   label:'Facebook QR', type:'image', store:'column', group:'template', section:'社群 QR（議程顯示用）', row:'qr' },
      { key:'line_qr_url', label:'LINE QR',     type:'image', store:'column', group:'template', section:'社群 QR（議程顯示用）', row:'qr' },
      { key:'charter_no',   label:'章程編號', type:'text', store:'column', group:'template', section:'標準版（企業家）專屬', row:'meta', placeholder:'No. 4069930' },
      { key:'founded_date', label:'成立日',   type:'text', store:'column', group:'template', section:'標準版（企業家）專屬', row:'meta', placeholder:'2014.06.29' },
      { key:'timeRange',  label:'預設時間 Time（議程可覆寫；日期仍動態帶入當日）', type:'text', store:'setting', group:'template', section:'標準版（企業家）專屬', placeholder:'19:10 ~ 21:00' },
      { key:'venue',      label:'預設地點 Venue（議程可覆寫）', type:'textarea', store:'setting', group:'template', section:'標準版（企業家）專屬', placeholder:'Venue: 鑫喜文創｜台北市信義區忠孝東路五段71巷11弄25號1樓\n（捷運板南線：市政府站4號出口，走路3分鐘）' },
      { key:'scheduleZh', label:'會議日期行（中文）',   type:'text', store:'setting', group:'template', section:'標準版（企業家）專屬', placeholder:'會議日期為每月第 1 個星期二 (中文) / 第 3 個星期二 (English)' },
      { key:'scheduleEn', label:'會議日期行（English）', type:'text', store:'setting', group:'template', section:'標準版（企業家）專屬', placeholder:'Meeting on every 1st (中文) and 3rd (English) Tuesday evening' },
    ],
    render(data, club, ctx) {
      const {
        t, esc, calcTimes, displayMember, buildSpeechAgendaLine,
        formatDate, varietySession, PATHWAYS, PATHWAYS_ZH, images, lang,
      } = ctx;

      const brand = {
        nameZh:    (club && club.name_zh)      || '企業家國際演講會',
        nameEn:    (club && club.name_en)      || 'Entrepreneur Toastmasters Club',
        charterNo: (club && club.charter_no)   || 'No. 4069930',
        founded:   (club && club.founded_date) || '2014.06.29',
        fee:       (club && club.fee)          || 'NTD150',
      };

      // Meeting-schedule line is club-managed (per language); fall back to the
      // historic hard-coded translation when a club hasn't set it.
      const set = (club && club.settings) || {};
      const schedule = (lang === 'zh' ? set.scheduleZh : set.scheduleEn) || t('meetingSchedule');

      // ---- header ----
      const dateDisplay = data.meetingDate ? formatDate(data.meetingDate) : '____.__.__';
      const logoHtml = images.logo
        ? `<img src="${images.logo}" class="hg-logo-img" alt="TM Logo">`
        : `<div class="hg-logo-ph"><div class="logo-ring"><span>TM</span></div></div>`;
      const themeImgHtml = images.themeImg
        ? `<img src="${images.themeImg}" class="hg-theme-img" alt="Theme">`
        : `<div class="hg-theme-ph"><span>Theme<br>Image</span></div>`;

      const headerHtml = `<div class="doc-header">
  <div class="hg-logo">${logoHtml}</div>
  <div class="hg-names">
    <div class="club-name-zh">${esc(brand.nameZh)}</div>
    <div class="club-name-en">${esc(brand.nameEn)}</div>
  </div>
  <div class="hg-img">${themeImgHtml}</div>
  <div class="hg-meta-left">
    <div>${esc(brand.charterNo)}</div>
    <div>${t('foundedSince')}:</div>
    <div>${esc(brand.founded)}</div>
    <div>&nbsp;</div>
    <div>${t('fee')} : ${esc(brand.fee)}</div>
  </div>
  <div class="hg-meta-right">
    <div class="hmr-text" style="grid-column:span 2"><strong>${t('thTime')} : ${dateDisplay} ｜ ${esc(data.timeRange)}</strong></div>
    <div class="hmr-text" style="grid-column:span 2">${esc(schedule)}</div>
    <div class="hmr-text" style="grid-column:span 2">${esc(data.venueInfo).replace(/\n/g, '<br>')}</div>
  </div>
</div>`;

      // ---- right panel (pathways / time rules / QR) ----
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

      const rightPanelHtml = `<div class="rp-wrap">
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

      // ---- body table ----
      const speechCount = data.speeches.length;
      const evalCount   = data.evaluators.length;
      const times = calcTimes(data.speeches);

      // rows: reception(1) + opening(5) + speech_header(1) + speeches(N)
      //       + photo(1) + intermission(1) + topics(1) + spacer(1)
      //       + eval_header(1) + evaluators(M) + timer(1) + ah(1) + LE(1) + GE(1)
      //       + closing(2) + sharing(1)  = 19 + N + M
      const totalRows = 19 + speechCount + evalCount;

      // Dynamic duration column width: size it to the longest single-column
      // duration string (e.g. "12'-15'") so double-digit minutes don't overflow.
      const DUR_POOL = 69; // mm shared by col-dur + col-agenda
      const durStrings = data.speeches.map(sp => sp.duration || "5'-7'").concat(["3'~5'"]);
      const maxDurLen = durStrings.reduce((m, s) => Math.max(m, String(s).length), 0);
      const durWidth = Math.min(16, Math.max(8, Math.round(maxDurLen * 1.5 + 3)));
      const agendaWidth = DUR_POOL - durWidth;

      let tbody = '';

      // Reception — right panel cell starts here with rowspan
      tbody += `
  <tr>
    <td class="time-cell">${times.receptionStart}</td>
    <td class="dur-cell" colspan="2">${times.receptionMins}'</td>
    <td class="agenda-cell">${t('reception')}</td>
    <td class="taker-cell">${esc(displayMember(data.receptionHost))}</td>
    <td class="rp-cell" rowspan="${totalRows}">${rightPanelHtml}</td>
  </tr>`;

      // Opening block — time & dur rowspan 5
      tbody += `
  <tr>
    <td class="time-cell" rowspan="5">${times.openingStart}</td>
    <td class="dur-cell" rowspan="5" colspan="2">${times.openingMins}'</td>
    <td class="agenda-cell">${t('callingOrder')}</td>
    <td class="taker-cell">${esc(displayMember(data.callingToOrder))}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('welcomeGuests')}</td>
    <td class="taker-cell">${esc(displayMember(data.welcomeTME))}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('tmeIntro')}</td>
    <td class="taker-cell">${esc(displayMember(data.tme))}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('timerExplain')}</td>
    <td class="taker-cell">${esc(displayMember(data.timer))}</td>
  </tr>
  <tr>
    <td class="agenda-cell">${t('ahExplain')}</td>
    <td class="taker-cell">${esc(displayMember(data.ahCounter))}</td>
  </tr>`;

      // Variety Session (optional)
      if (varietySession.enabled) {
        tbody += `
  <tr class="row-section">
    <td class="time-cell">${times.speechStart}</td>
    <td class="dur-cell" colspan="2">${times.varietyMins}'</td>
    <td class="agenda-cell"><strong>${t('varietySession')}</strong></td>
    <td class="taker-cell">${esc(displayMember(varietySession.host))}</td>
  </tr>`;
      }

      // Prepared Speech block — time rowspan = 1 + speechCount
      const speechBlockSpan = 1 + speechCount;
      tbody += `
  <tr class="row-section">
    <td class="time-cell" rowspan="${speechBlockSpan}">${times.preparedSpeechStart}</td>
    <td class="secdur-cell" rowspan="${speechBlockSpan}">${times.speechMins}'</td>
    <td class="agenda-cell" colspan="2"><strong>${t('preparedSpeech')}</strong></td>
    <td class="taker-cell">${esc(displayMember(data.tme))}</td>
  </tr>`;

      data.speeches.forEach(sp => {
        tbody += `
  <tr>
    <td class="dur-cell">${esc(sp.duration || "5'-7'")}</td>
    <td class="agenda-cell">${buildSpeechAgendaLine(sp)}</td>
    <td class="taker-cell">${esc(displayMember(sp.speaker))}</td>
  </tr>`;
      });

      // Group Photo
      tbody += `
  <tr>
    <td class="time-cell">${times.photoStart}</td>
    <td class="dur-cell" colspan="2">${times.photoMins}'</td>
    <td class="agenda-cell">${t('groupPhoto')}</td>
    <td class="taker-cell">${t('allParticipants')}</td>
  </tr>`;

      // Intermission
      tbody += `
  <tr class="row-intermission">
    <td colspan="5">${t('intermission', times.intermissionMins)}</td>
  </tr>`;

      // Table Topics
      tbody += `
  <tr class="row-section">
    <td class="time-cell">${times.topicsStart}</td>
    <td class="dur-cell" colspan="2">${times.topicsMins}'</td>
    <td class="agenda-cell"><strong>${t('tableTopics')}</strong></td>
    <td class="taker-cell">${esc(displayMember(data.tableTopicsMaster))}</td>
  </tr>`;

      // Spacer
      tbody += `<tr class="row-spacer"><td colspan="5"></td></tr>`;

      // Evaluation block — rowspan = 1 (header) + M (evaluators) + 4 (timer, ah, LE, GE)
      const evalRowSpan = evalCount + 5;
      tbody += `
  <tr class="row-section">
    <td class="time-cell" rowspan="${evalRowSpan}">${times.evalStart}</td>
    <td class="secdur-cell" rowspan="${evalRowSpan}">${times.evalMins}'</td>
    <td class="agenda-cell" colspan="2"><strong>${t('evaluation')}</strong></td>
    <td class="taker-cell">${esc(displayMember(data.generalEvaluator))}</td>
  </tr>`;

      data.evaluators.forEach((ev, i) => {
        tbody += `
  <tr>
    <td class="dur-cell">2'~3'</td>
    <td class="agenda-cell">${t('evaluatorFor', i + 1)}</td>
    <td class="taker-cell">${esc(displayMember(ev))}</td>
  </tr>`;
      });

      tbody += `
  <tr>
    <td class="dur-cell">1'</td>
    <td class="agenda-cell">${t('timerReport')}</td>
    <td class="taker-cell">${esc(displayMember(data.timer))}</td>
  </tr>
  <tr>
    <td class="dur-cell">1'</td>
    <td class="agenda-cell">${t('ahReport')}</td>
    <td class="taker-cell">${esc(displayMember(data.ahCounter))}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'~5'</td>
    <td class="agenda-cell">${t('langEval')}</td>
    <td class="taker-cell">${esc(displayMember(data.langEvaluator))}</td>
  </tr>
  <tr>
    <td class="dur-cell">3'~5'</td>
    <td class="agenda-cell">${t('generalEval')}</td>
    <td class="taker-cell">${esc(displayMember(data.generalEvaluator))}</td>
  </tr>`;

      // Closing — time rowspan 2
      tbody += `
  <tr>
    <td class="time-cell" rowspan="2">${times.closingStart}</td>
    <td class="dur-cell" colspan="2">${Math.ceil(times.closingMins / 2)}'</td>
    <td class="agenda-cell">${t('tmeClosing')}</td>
    <td class="taker-cell">${esc(displayMember(data.tme))}</td>
  </tr>
  <tr>
    <td class="dur-cell" colspan="2">${Math.floor(times.closingMins / 2)}'</td>
    <td class="agenda-cell">${t('awards')}</td>
    <td class="taker-cell">${esc(displayMember(data.awardsPresenter))}</td>
  </tr>`;

      // Sharing & Feedback
      tbody += `
  <tr>
    <td class="time-cell">${times.sharingStart}</td>
    <td class="dur-cell" colspan="2">${times.sharingMins}'</td>
    <td class="agenda-cell">${t('sharing')}</td>
    <td class="taker-cell">${esc(displayMember(data.sharingFeedback))}</td>
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
    <col class="col-secdur">
    <col class="col-dur" style="width:${durWidth}mm">
    <col class="col-agenda" style="width:${agendaWidth}mm">
    <col class="col-taker">
    <col class="col-rp">
  </colgroup>
  <thead>
    <tr>
      <th>${t('thTime')}</th>
      <th colspan="2"></th>
      <th>${t('thAgenda')}</th>
      <th>${t('thTaker')}</th>
      <th>${t('thPathways')}</th>
    </tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>

<div class="agenda-footer">${t('adjournment')}</div>
`;
    },
  },

  // --------------------------------------------------------------
  // COMPACT — a deliberately different single-column layout (no right
  // pathways panel, simpler header). Demonstrates that a club can use a
  // structurally different template. All styles are namespaced .tmpl-compact.
  // --------------------------------------------------------------
  compact: {
    key: 'compact',
    label: '精簡版（單欄）',
    langToggle: true,        // offers a 中/英 switch
    assetDefaults: {},       // uses no logo/QR
    settings: [],            // no club-editable template-specific fields
    render(data, club, ctx) {
      const { t, esc, calcTimes, displayMember, buildSpeechAgendaLine, formatDate, varietySession, lang } = ctx;

      const brand = {
        nameZh: (club && club.name_zh) || '企業家國際演講會',
        nameEn: (club && club.name_en) || 'Entrepreneur Toastmasters Club',
      };
      const dateDisplay = data.meetingDate ? formatDate(data.meetingDate) : '____.__.__';
      const times = calcTimes(data.speeches);

      // Each entry: [time, dur, agenda(html), taker(html), isSection]
      const rows = [];
      const section = (time, dur, label) => rows.push([time, dur, `<strong>${label}</strong>`, '', true]);
      const item    = (time, dur, label, who) => rows.push([time, dur, label, who, false]);

      item(times.receptionStart, `${times.receptionMins}'`, t('reception'), esc(displayMember(data.receptionHost)));
      section(times.openingStart, `${times.openingMins}'`, lang === 'zh' ? '開場' : 'Opening');
      item('', '', t('callingOrder'), esc(displayMember(data.callingToOrder)));
      item('', '', t('welcomeGuests'), esc(displayMember(data.welcomeTME)));
      item('', '', t('tmeIntro'), esc(displayMember(data.tme)));
      item('', '', t('timerExplain'), esc(displayMember(data.timer)));
      item('', '', t('ahExplain'), esc(displayMember(data.ahCounter)));

      if (varietySession.enabled) {
        section(times.speechStart, `${times.varietyMins}'`, t('varietySession'));
        item('', '', '', esc(displayMember(varietySession.host)));
      }

      section(times.preparedSpeechStart, `${times.speechMins}'`, t('preparedSpeech'));
      data.speeches.forEach(sp => {
        item('', esc(sp.duration || "5'-7'"), buildSpeechAgendaLine(sp), esc(displayMember(sp.speaker)));
      });

      item(times.photoStart, `${times.photoMins}'`, t('groupPhoto'), t('allParticipants'));
      item(times.topicsStart, `${times.intermissionMins}'`, t('intermission', times.intermissionMins), '');
      section(times.topicsStart, `${times.topicsMins}'`, t('tableTopics'));
      item('', '', '', esc(displayMember(data.tableTopicsMaster)));

      section(times.evalStart, `${times.evalMins}'`, t('evaluation'));
      item('', '', t('generalEval'), esc(displayMember(data.generalEvaluator)));
      data.evaluators.forEach((ev, i) => item('', "2'~3'", t('evaluatorFor', i + 1), esc(displayMember(ev))));
      item('', "1'", t('timerReport'), esc(displayMember(data.timer)));
      item('', "1'", t('ahReport'), esc(displayMember(data.ahCounter)));
      item('', "3'~5'", t('langEval'), esc(displayMember(data.langEvaluator)));

      section(times.closingStart, `${times.closingMins}'`, t('tmeClosing'));
      item('', '', t('awards'), esc(displayMember(data.awardsPresenter)));
      item(times.sharingStart, `${times.sharingMins}'`, t('sharing'), esc(displayMember(data.sharingFeedback)));

      const tbody = rows.map(([time, dur, agenda, who, isSec]) => `
    <tr class="${isSec ? 'c-row-section' : ''}">
      <td class="c-time">${time}</td>
      <td class="c-dur">${dur}</td>
      <td class="c-agenda">${agenda}</td>
      <td class="c-taker">${who}</td>
    </tr>`).join('');

      return `
<div class="c-header">
  <div class="c-club">${esc(brand.nameZh)} <span class="c-club-en">${esc(brand.nameEn)}</span></div>
  <div class="c-meta">${t('thTime')} : ${dateDisplay} ｜ ${esc(data.timeRange)} ｜ ${t('meetingNoLabel', data.meetingNo)}</div>
  <div class="c-theme">${t('themeLabel')} <strong><em>${esc(data.meetingTheme) || '—'}</em></strong></div>
</div>

<table class="c-table">
  <thead>
    <tr><th>${t('thTime')}</th><th></th><th>${t('thAgenda')}</th><th>${t('thTaker')}</th></tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>

<div class="c-footer">${t('adjournment')}</div>
`;
    },
  },

  // --------------------------------------------------------------
  // CHILL HI HIGH — bilingual humor club layout: inline green/yellow/red
  // time-signal columns, extra ceremonial roles, and a Meeting Roles glossary.
  // Per-meeting signal times come from ctx.signals (editable in the form).
  // Branding extras (slogan / transit / closingLine) live in club.settings.
  // --------------------------------------------------------------
  chillhihigh: {
    key: 'chillhihigh',
    label: '雙語幽默版（Chill Hi High）',
    fields: ['chillhihigh'],
    // Inherently 中英混用: no language switch, pinned render lang, and member
    // names show English + Chinese together.
    langToggle: false,
    fixedLang: 'zh',
    bilingualNames: true,
    assetDefaults: CHH_ASSETS,
    fieldDefaults: CHH_FIELD_DEFAULTS,
    settings: [
      { key:'logo_url', label:'Logo', type:'image', store:'column', group:'basic', section:'Logo（上傳至雲端）' },
      { key:'venue', label:'預設地點 Venue（議程可覆寫）', type:'textarea', store:'setting', group:'template', section:'版型專屬設定', placeholder:'社會創新實驗中心 (臺北市大安區仁愛路三段 99 號) 107 會議室' },
      { key:'fb_qr_url',   label:'Facebook QR',  type:'image', store:'column',  group:'template', section:'社群 QR（議程顯示用）', row:'qr' },
      { key:'line_qr_url', label:'LINE QR',      type:'image', store:'column',  group:'template', section:'社群 QR（議程顯示用）', row:'qr' },
      { key:'ig_qr_url',   label:'Instagram QR', type:'image', store:'setting', group:'template', section:'社群 QR（議程顯示用）', row:'qr' },
      { key:'slogan',      label:'標語 Slogan',       type:'text', store:'setting', group:'template', section:'版型專屬設定', placeholder:'Amuse to Amaze: A bilingual Toastmasters club…' },
      { key:'transit',     label:'交通 Transit',      type:'text', store:'setting', group:'template', section:'版型專屬設定', placeholder:'忠孝復興捷運站 2 號出口步行 7 分鐘' },
      { key:'closingLine', label:'結尾句 Closing Line', type:'text', store:'setting', group:'template', section:'版型專屬設定', placeholder:'活動結束，期待下次與你一起 Chill Hi High！' },
      { key:'upcomingMeetings', label:'近期例會 Upcoming Meetings', type:'text', store:'setting', group:'template', section:'第二頁宣傳後頁（Chill Hi High 版型）', placeholder:'5/26、6/9、6/23、7/14、7/28' },
      { key:'specialEvent', label:'特別活動 Special Event', type:'text', store:'setting', group:'template', section:'第二頁宣傳後頁（Chill Hi High 版型）', placeholder:'7/28 (二) 新任幹部交接典禮' },
      { key:'membershipFee', label:'入會費用 Membership Fee', type:'text', store:'setting', group:'template', section:'第二頁宣傳後頁（Chill Hi High 版型）', placeholder:'TWD $6,000（含年費 5,000 + 終身註冊費 1,000）' },
      { key:'page2_hero_url', label:'第二頁 圖1 Hero（我們是誰）', type:'image', store:'setting', group:'template', section:'第二頁宣傳後頁（Chill Hi High 版型）', row:'p2img' },
      { key:'page2_img2_url', label:'第二頁 圖2（招生／入會流程／Pathways）', type:'image', store:'setting', group:'template', section:'第二頁宣傳後頁（Chill Hi High 版型）', row:'p2img' },
    ],
    render(data, club, ctx) {
      const { esc, calcTimes, displayMember, buildSpeechAgendaLine, formatDate, varietySession, signals } = ctx;
      const s = { ...{
        variety: {}, preparedSpeech: {}, tableTopics: {}, evaluation: {},
        langEval: {}, generalEval: {}, ttSpeakerSpec: '',
      }, ...(signals || {}) };
      const set = club && club.settings || {};

      const brand = {
        nameZh: (club && club.name_zh) || '中英雙語國際演講會',
        nameEn: (club && club.name_en) || 'Chill Hi High Toastmasters Club',
        fee:    (club && club.fee) || '',
      };

      // Bundled default assets (CHH_ASSETS) overridable by a club upload
      // (top-level columns for logo/QR, settings for page-2 images).
      const A = CHH_ASSETS;
      const img = {
        logo: (club && club.logo_url)   || A.logo_url,
        fb:   (club && club.fb_qr_url)  || A.fb_qr_url,
        line: (club && club.line_qr_url)|| A.line_qr_url,
        ig:   set.ig_qr_url             || A.ig_qr_url,
        hero: set.page2_hero_url        || A.page2_hero_url,
        img2: set.page2_img2_url        || A.page2_img2_url,
      };

      const dateDisplay = data.meetingDate ? formatDate(data.meetingDate) : '____.__.__';
      const times = calcTimes(data.speeches);

      const m  = v => esc(displayMember(v));
      // bare numbers get a trailing '; values like 2'30" are shown as-is
      const fmtSig = v => (v == null || v === '') ? '' : (/^\d+$/.test(String(v)) ? `${v}'` : esc(v));
      const sig = cat => {
        const o = s[cat] || {};
        return `<td class="ch-g">${fmtSig(o.g)}</td><td class="ch-y">${fmtSig(o.y)}</td><td class="ch-r">${fmtSig(o.r)}</td>`;
      };
      const noSig = `<td></td><td></td><td></td>`;

      let rows = '';
      const row = (time, dur, agenda, host, sigCells = noSig, cls = '') => {
        rows += `<tr class="${cls}"><td class="ch-time">${esc(time || '')}</td><td class="ch-dur">${esc(dur == null ? '' : String(dur))}</td><td class="ch-ag">${agenda}</td><td class="ch-host">${host}</td>${sigCells}</tr>`;
      };
      const full = label => { rows += `<tr class="ch-band"><td colspan="7">${label}</td></tr>`; };

      // ---- Opening / first half ----
      row(times.receptionStart, times.receptionMins, '報到 Registration', m(data.receptionHost));
      row(times.openingStart, '', '致歡迎詞 Opening Remarks', m(data.callingToOrder));
      row('', '', '總主持人上半場開場 TME Opening - First Half', m(data.tme));
      row('', '', '計時員介紹 Timer Introduction', m(data.timer));
      row('', '', '贅字/笑聲記錄員介紹 Ah/Ha Counter Introduction', m(data.ahCounter));
      row('', '', '白板記錄員 Board Writer / 攝影師 Photographer',
        [m(data.boardWriter), m(data.photographer)].filter(Boolean).join(' / '));

      if (varietySession.enabled) {
        row(times.speechStart, times.varietyMins, '<strong>暖場活動 Variety Session</strong>',
          m(varietySession.host), sig('variety'), 'ch-section');
      }

      // ---- Prepared speeches ----
      row(times.preparedSpeechStart, times.speechMins, '<strong>指定演講 Prepared Speeches</strong>', m(data.tme), noSig, 'ch-section');
      data.speeches.forEach(sp => {
        row('', esc(sp.duration || "5'-7'"), buildSpeechAgendaLine(sp), m(sp.speaker), sig('preparedSpeech'));
      });
      row('', '', '計時員報告 Timer\'s Report', m(data.timer));
      row('', '', '贅字/笑聲記錄員報告 Ah/Ha Counter\'s Report', m(data.ahCounter));
      row('', '', '來賓介紹 Guest Introduction', m(data.tme));

      // ---- Intermission / second half ----
      full('團體照、中場休息 Group Photo &amp; Intermission');
      row(times.topicsStart, '', '總主持人下半場開場 TME Opening - Second Half', m(data.tme));
      row('', times.topicsMins,
        `<strong>小組即席問答 Group Table Topics Session</strong>${s.ttSpeakerSpec ? ` <span class="ch-spec">(講者: ${esc(s.ttSpeakerSpec)})</span>` : ''}`,
        m(data.tableTopicsMaster), sig('tableTopics'), 'ch-section');

      // ---- Evaluation ----
      row(times.evalStart, times.evalMins, '<strong>講評環節 Evaluation Session</strong>', m(data.generalEvaluator), noSig, 'ch-section');
      // Each individual evaluator is matched to the same-index prepared speech;
      // label them by that speech's language (default English).
      data.evaluators.forEach((ev, i) => {
        const sp = data.speeches[i];
        const label = (sp && sp.speechLang === 'zh')
          ? '國語講評員 Mandarin Evaluator'
          : '英語講評員 English Evaluator';
        row('', '', label, m(ev), sig('evaluation'));
      });
      row('', '', '計時員報告 Timer\'s Report', m(data.timer));
      row('', '', '贅字/笑聲記錄員報告 Ah/Ha Counter\'s Report', m(data.ahCounter));
      row('', '', '語言/幽默講評 Language/Humor Evaluation', m(data.langEvaluator), sig('langEval'));
      row(times.closingStart, '', '總講評 General Evaluation', m(data.generalEvaluator), sig('generalEval'));
      row(times.sharingStart, times.sharingMins, '來賓回饋與結語 Guest Feedback &amp; Closing Remarks', m(data.sharingFeedback));

      // ---- Meeting Roles glossary (static, bilingual) ----
      const roleGloss = [
        ['總主持人<br>Toastmaster of the Evening (TME)', '決定例會主題，並主持及串接整場會議流程與互動'],
        ['計時員<br>Timer', '協助講者在指定時間內完成演講'],
        ['贅字/笑聲記錄員<br>Ah/Ha Counter', '紀錄講者的冗言贅字及觀眾笑聲次數'],
        ['暖場活動主持人<br>Variety Session Master', '活絡例會氣氛，鼓勵參與者互相認識'],
        ['備稿演講者<br>Prepared Speech Speaker', '依循學習途徑 (Pathways) 的專案目標，準備 5-7 分鐘演講'],
        ['小組即席問答主持人<br>Group Table Topics Master', '準備 4-6 題目，帶領小組討論，並邀請成員上台分享 1-2 分鐘的答案'],
        ['總講評<br>General Evaluator', '介紹例會後半場的講評員，並提供整場會議總體評價'],
        ['個別講評員<br>Individual Evaluator', '針對備稿演講者提供 2-3 分鐘講評、鼓勵與改進建議'],
        ['語言/幽默講評<br>Language/Humor Evaluator', '整理全場用語、文法、佳句與幽默設計'],
      ].map(([r, d]) => `<div class="ch-role"><div class="ch-role-t">${r}</div><div class="ch-role-d">${d}</div></div>`).join('');

      const logoHtml = `<img src="${img.logo}" class="ch-logo-img" alt="logo">`;

      const page1 = `
<div class="ch-header">
  <div class="ch-logo">${logoHtml}</div>
  <div class="ch-titles">
    <div class="ch-name"><strong>${esc(brand.nameEn)}</strong> ${esc(brand.nameZh)}</div>
    ${set.slogan ? `<div class="ch-slogan">${esc(set.slogan)}</div>` : ''}
    <div class="ch-info">
      <div>時間 : ${dateDisplay} ${esc(data.timeRange)}</div>
      <div>地點 : ${esc(data.venueInfo).replace(/\n/g, '<br>')}</div>
      ${set.transit ? `<div>交通 : ${esc(set.transit)}</div>` : ''}
      ${brand.fee ? `<div>入場費 : ${esc(brand.fee)}</div>` : ''}
    </div>
  </div>
</div>

<div class="ch-theme">
  <div>會議主題 : ${esc(data.meetingTheme) || '—'}</div>
  ${data.tableTopicsQuestion ? `<div class="ch-theme-q">主題題目 : ${esc(data.tableTopicsQuestion)}</div>` : ''}
</div>

<table class="ch-table">
  <colgroup><col class="ch-c-time"><col class="ch-c-dur"><col class="ch-c-ag"><col class="ch-c-host"><col span="3" class="ch-c-sig"></colgroup>
  <thead>
    <tr>
      <th rowspan="2">時間</th><th rowspan="2">時長(分)</th><th rowspan="2">議程</th><th rowspan="2">主持</th>
      <th colspan="3">時間管理</th>
    </tr>
    <tr><th class="ch-g">綠牌</th><th class="ch-y">黃牌</th><th class="ch-r">紅牌</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="ch-footer">${esc(set.closingLine) || '活動結束'}</div>

<div class="ch-roles">
  <div class="ch-roles-title">例會角色 Meeting Roles</div>
  <div class="ch-roles-grid">${roleGloss}</div>
</div>
`;

      // ================= PAGE 2 — club promo back-page =================
      // Static parts are images (hero banner + a combined pitch/join/pathways
      // graphic); only "近期例會" is dynamic. Images default to bundled assets
      // and are overridable per club. When img2 is absent, fall back to HTML.
      const heroHtml = `<div class="ch2-hero"><img src="${img.hero}" class="ch2-hero-img" alt="intro"></div>`;

      const pathways = [
        ['Engaging Humor', '善用幽默 (EH)'],
        ['Dynamic Leadership', '活力領導 (DL)'],
        ['Motivational Strategies', '激勵策略 (MS)'],
        ['Persuasive Influence', '說服影響 (PI)'],
        ['Presentation Mastery', '精通演講 (PM)'],
        ['Visionary Communication', '願景溝通 (VC)'],
      ].map(([en, zh]) => `<div class="ch2-pw"><div class="ch2-pw-zh">${zh}</div><div class="ch2-pw-en">${en}</div></div>`).join('');

      const joinSteps = [
        ['1', '填寫入會表格'],
        ['2', `繳交入會費用${set.membershipFee ? `<br><span class="ch2-fee">${esc(set.membershipFee)}</span>` : ''}`],
        ['3', '參加迎新會'],
        ['4', '成為會員'],
      ].map(([n, label]) => `<div class="ch2-step"><span class="ch2-step-n">${n}</span><span class="ch2-step-l">${label}</span></div>`).join('');

      const wishList = [
        '克服舞台恐懼 Overcome stage fright',
        '提升舞台表現與幽默感 Enhance stage presence and sense of humor',
        '增強領導力 Strengthen leadership skills',
        '擴大人脈圈 Expand your network',
        '…或其他 Or others',
      ].map(w => `<li>${esc(w)}</li>`).join('');

      const qrItems = [
        [img.fb, 'Facebook'],
        [img.ig, 'Instagram'],
        [img.line, 'LINE'],
      ].filter(([u]) => u)
       .map(([u, label]) => `<div class="ch2-qr"><div class="ch2-qr-l">${label}</div><img src="${u}" class="ch2-qr-img" alt="${label}"></div>`)
       .join('');

      // The combined pitch/join/pathways graphic; HTML fallback if no image.
      const bodyHtml = img.img2
        ? `<div class="ch2-img2"><img src="${img.img2}" class="ch2-img2-img" alt="join"></div>`
        : `
  <div class="ch2-join">
    <div class="ch2-join-left">
      <div class="ch2-title">如果你想要…</div>
      <ul class="ch2-wish">${wishList}</ul>
    </div>
    <div class="ch2-join-right">
      加入 ${esc(brand.nameZh)}，我們一起實現你/妳的成長目標！<br>
      <em>Become a member of ${esc(brand.nameEn)}, and let's achieve your goals together!</em>
    </div>
  </div>
  <div class="ch2-block">
    <div class="ch2-title">入會流程 How to Join</div>
    <div class="ch2-steps">${joinSteps}</div>
  </div>
  <div class="ch2-block">
    <div class="ch2-title">國際演講會 學習途徑 Toastmasters Pathways</div>
    <div class="ch2-pw-grid">${pathways}</div>
  </div>`;

      const page2 = `
<div class="ch2-page">
  ${heroHtml}

  ${(set.upcomingMeetings || set.specialEvent) ? `
  <div class="ch2-block">
    <div class="ch2-title">未來例會及活動時間 Upcoming Meetings &amp; Events</div>
    <div class="ch2-upcoming">
      ${set.upcomingMeetings ? `<div><strong>例會</strong>：${esc(set.upcomingMeetings)}</div>` : ''}
      ${set.specialEvent ? `<div><strong>特別活動</strong>：${esc(set.specialEvent)}</div>` : ''}
    </div>
  </div>` : ''}

  ${bodyHtml}

  ${qrItems ? `<div class="ch2-qrs">${qrItems}</div>` : ''}
</div>
`;

      return [page1, page2];
    },
  },
};

// Metadata for the club-management template picker (no render fns).
const TEMPLATE_OPTIONS = Object.values(AGENDA_TEMPLATES).map(t => ({ key: t.key, label: t.label }));

// Per-template default resolvers (single source of truth for fallbacks).
// Used by app.js and club.html so default assets/values live in one place.
function templateAssetDefaults(key) {
  return (AGENDA_TEMPLATES[key] || AGENDA_TEMPLATES.standard).assetDefaults || {};
}
function templateFieldDefaults(key) {
  return (AGENDA_TEMPLATES[key] || AGENDA_TEMPLATES.standard).fieldDefaults || {};
}

// Unified per-template visibility: show elements whose data-tmpl lists `key`,
// hide the rest. Used by the agenda form (app.js); the club modal generates
// its template-specific fields directly, so it no longer needs this.
function applyTmplVisibility(root, key) {
  root.querySelectorAll('[data-tmpl]').forEach(el => {
    el.style.display = el.dataset.tmpl.split(/\s+/).includes(key) ? '' : 'none';
  });
}
