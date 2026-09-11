import type { TranslationKey } from '../constants/i18n/translations';

/**
 * The app formatted dates four different ways across screens
 * (`toLocaleDateString('ar-SA')`, raw ISO strings, `new Date().toISOString()`),
 * which is how a medical history ends up showing "2026-09-11T03:14:22.881Z"
 * to a patient. One helper, locale-aware, used everywhere.
 */

const AR_DATE = 'ar-EG';
const EN_DATE = 'en-GB';

export function formatDate(iso: string | undefined, isRTL: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isRTL ? AR_DATE : EN_DATE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "3 days ago" / "منذ ٣ أيام" style, falling back to a date past a week. */
export function formatRelative(
  iso: string | undefined,
  isRTL: boolean,
  t: (k: TranslationKey) => string,
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return t('justNow');
  if (mins < 60) return `${t('timeAgo')} ${mins}m`;
  if (hours < 24) return `${t('timeAgo')} ${hours}h`;
  if (days === 1) return t('yesterday');
  if (days < 7) return `${t('timeAgo')} ${days}d`;
  return formatDate(iso, isRTL);
}

/** Normalize "8:5" / "08:05" / "20:05" into a display-friendly HH:MM. */
export function formatTime(raw: string | undefined): string {
  if (!raw) return '—';
  const [h, m] = raw.split(':');
  const hh = String(Number(h)).padStart(2, '0');
  const mm = String(m ?? '00').padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Minutes since midnight for "is this dose still upcoming today" checks. */
export function timeToMinutes(raw: string | undefined): number {
  if (!raw) return -1;
  const [h, m] = raw.split(':').map(Number);
  if (Number.isNaN(h)) return -1;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

/** True when the given ISO date is the same calendar day as now. */
export function isToday(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Initials for the avatar — handles single-word and empty names. */
export function initials(name: string | undefined): string {
  if (!name?.trim()) return '؟';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}
