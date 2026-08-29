'use client';

// ================================================================
// SOCIAL PLATFORM SPECS
// ================================================================
// What differs between Facebook, Instagram and Threads, expressed once so the
// composer's counters, warnings and preview cards all agree. The backend keeps
// its own short prose version of the same rules for the copywriting prompt
// (api/index.py, _PLATFORM_BRIEF) — that one is instructions for a model, this
// one is checks for a person, so they are deliberately not shared.
//
// LinkedIn is absent on purpose: its posting API is gated behind a partner
// review that the club has not started, so shipping a LinkedIn tab now would
// promise something the app cannot do.

export const SOCIAL_PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook',
    short: 'FB',
    // Facebook's own cap. Nobody reaches it — the counter exists so the field
    // has the same furniture as the other two, and turns amber long before.
    max: 63206,
    soft: 1500,
    needsImage: false,
    linksClickable: true,
    hint: '連結可點。字數寬鬆，但超過 3 行就會被折疊成「查看更多」。',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    short: 'IG',
    max: 2200,
    soft: 1200,
    needsImage: true,
    linksClickable: false,
    hint: '一定要有圖。內文連結不可點，請改寫成「報名連結在個人簡介」。',
  },
  {
    key: 'threads',
    label: 'Threads',
    short: 'TH',
    max: 500,
    soft: 450,
    needsImage: false,
    linksClickable: true,
    hint: '上限 500 字，口語為主，hashtag 越少越好。',
  },
];

export const PLATFORM_KEYS = SOCIAL_PLATFORMS.map((p) => p.key);

export const platformSpec = (key) =>
  SOCIAL_PLATFORMS.find((p) => p.key === key) || SOCIAL_PLATFORMS[0];

/** Bare URLs in the caption — the thing Instagram silently renders as plain text. */
const URL_RE = /\bhttps?:\/\/[^\s]+/gi;

/**
 * Everything wrong with one platform's caption right now.
 * Returns [{ level: 'error' | 'warn', text }] — `error` means the platform
 * would reject or mangle it, `warn` means it will post but read badly.
 */
export function platformWarnings(key, text, images = []) {
  const spec = platformSpec(key);
  const body = String(text || '');
  const out  = [];

  if (spec.needsImage && !images.length) {
    out.push({ level: 'error', text: `${spec.label} 貼文一定要有圖片，請先上傳至少一張` });
  }
  if (!body.trim()) {
    out.push({ level: 'error', text: '文案還是空的' });
  }
  if (body.length > spec.max) {
    out.push({ level: 'error', text: `超出 ${spec.label} 上限 ${body.length - spec.max} 字` });
  } else if (body.length > spec.soft) {
    out.push({ level: 'warn', text: `已經 ${body.length} 字，${spec.label} 上偏長` });
  }

  const links = body.match(URL_RE) || [];
  if (links.length && !spec.linksClickable) {
    out.push({
      level: 'warn',
      text: `${spec.label} 的內文連結不可點（${links[0]}），建議改寫成「連結在個人簡介」`,
    });
  }
  return out;
}

/** Simple, predictable count — what the platforms themselves show. */
export const charCount = (text) => String(text || '').length;
