import './shotguns.entry.css';
import type { AppContext } from '../../app/app-types';
import type { VivaFeatureController, FeatureActivation } from '../../app/feature-contract';
import type { VivaShotguns } from '../../data/generated/asset-types';
type ShotgunRecord = VivaShotguns[number];
import { resolveVivaOwner, vivaOwnerImage, vivaShotgunDisplayName } from '../../viva/owners';

const MEDIA_BASE_URL = String(import.meta.env.VITE_VIVA_MEDIA_BASE_URL || '').replace(/\/$/, '');

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function mediaUrl(key: string): string | null {
  if (!MEDIA_BASE_URL || !/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) return null;
  return `${MEDIA_BASE_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function normalizeRows(rows: ShotgunRecord[] | null): ShotgunRecord[] {
  return Array.isArray(rows) ? rows.filter(row => resolveVivaOwner(row.owner)) : [];
}

function card(row: ShotgunRecord): string {
  const identity = vivaOwnerImage(row.owner);
  const owner = vivaShotgunDisplayName(row.owner);
  return `<article class="shotgun-card"><div class="shotgun-card-header">${identity ? `<img src="${escapeHtml(identity.src)}" alt="${escapeHtml(identity.alt)}" />` : ''}<h3>${escapeHtml(owner)}</h3></div><p>${escapeHtml(row.date)}${row.week ? ` · Week ${row.week}` : ''}</p><p>${escapeHtml(row.cause)}</p><button class="btn shotgun-play" type="button" data-shotgun-id="${escapeHtml(row.id)}" ${row.media_key && MEDIA_BASE_URL ? '' : 'disabled'}>${row.media_key && MEDIA_BASE_URL ? 'Play clip' : 'Media unavailable'}</button></article>`;
}

export function createFeatureController(): VivaFeatureController {
  let context: AppContext;
  let active = false;
  let rows: ShotgunRecord[] = [];
  let root: HTMLElement | null = null;
  let dialog: HTMLDialogElement | null = null;
  let video: HTMLVideoElement | null = null;
  let lastFocused: HTMLElement | null = null;

  const closeDialog = () => {
    video?.pause();
    if (video) video.removeAttribute('src');
    if (dialog?.open) dialog.close();
    lastFocused?.focus();
  };

  const render = () => {
    if (!root) return;
    const owed = rows.filter(row => !row.completed).sort((a, b) => String(b.due_date || '').localeCompare(String(a.due_date || '')));
    const completed = rows.filter(row => row.completed).sort((a, b) => b.date.localeCompare(a.date));
    const owners = [...new Set(rows.map(row => row.owner))].sort();
    root.innerHTML = `<div class="shotgun-summary"><p>${owed.length} owed · ${completed.length} completed · ${rows.length} total</p>${!MEDIA_BASE_URL ? '<p class="status-banner status-warning" role="status">Shotgun media is not configured for this deployment. All records remain available.</p>' : ''}</div><section class="card"><h3>Shotguns Owed</h3>${owed.length ? `<div class="table-wrap"><table><thead><tr><th>Owner</th><th>Week</th><th>Cause</th><th>Date</th><th>Due</th></tr></thead><tbody>${owed.map(row => `<tr><td>${escapeHtml(vivaShotgunDisplayName(row.owner))}</td><td>${escapeHtml(row.week ?? '—')}</td><td>${escapeHtml(row.cause)}</td><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.due_date || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No shotguns owed.</p>'}</section><section class="card"><h3>Completed Shotguns</h3><div class="shotgun-grid">${owners.flatMap(owner => completed.filter(row => row.owner === owner)).map(card).join('') || '<p class="muted">No completed Shotguns available.</p>'}</div></section>`;
    root.querySelectorAll<HTMLButtonElement>('.shotgun-play').forEach(button => button.addEventListener('click', () => {
      const row = rows.find(candidate => candidate.id === button.dataset.shotgunId);
      const source = row?.media_key ? mediaUrl(row.media_key) : null;
      if (!row || !source || !dialog || !video) return;
      lastFocused = button;
      video.src = source;
      dialog.showModal();
      void video.play().catch(() => {});
    }));
  };

  return {
    id: 'shotguns',
    mount(nextContext) {
      context = nextContext;
      root = context.document.getElementById('shotgunsRoot');
      dialog = context.document.getElementById('shotgunDialog') as HTMLDialogElement | null;
      video = context.document.getElementById('shotgunVideo') as HTMLVideoElement | null;
      if (!root || !dialog || !video) throw new Error('Shotguns feature roots missing');
      dialog.querySelector('[data-shotgun-close]')?.addEventListener('click', closeDialog);
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
    },
    activate(input: FeatureActivation) {
      active = !input.signal.aborted;
      rows = normalizeRows(context.data.shotguns);
      context.header.feature('Shotguns', null, 'Shotguns — Viva');
      context.theme.league();
      render();
    },
    deactivate() { active = false; closeDialog(); },
    dispose() { active = false; closeDialog(); root?.replaceChildren(); root = null; },
  };
}
