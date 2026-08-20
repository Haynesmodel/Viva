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

function recordLabel(row: ShotgunRecord, action: 'play' | 'unavailable'): string {
  const owner = vivaShotgunDisplayName(row.owner);
  const details = `${owner}'s Shotgun from ${row.date}: ${row.cause} (record ${row.id})`;
  return action === 'play' ? `Play ${details}` : `Media unavailable for ${details}`;
}

function completedRecord(row: ShotgunRecord): string {
  const playable = Boolean(row.media_key && MEDIA_BASE_URL);
  const label = recordLabel(row, playable ? 'play' : 'unavailable');
  return `<li class="shotgun-record"><div class="shotgun-record-details"><strong>${escapeHtml(row.date)}</strong>${row.week ? `<span>Week ${escapeHtml(row.week)}</span>` : ''}<span>${escapeHtml(row.cause)}</span></div><button class="btn shotgun-play" type="button" data-shotgun-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(label)}" ${playable ? '' : 'disabled'}>${playable ? 'Play clip' : 'Media unavailable'}</button></li>`;
}

function ownerTile(owner: string, owedCount: number, completed: ShotgunRecord[]): string {
  const identity = vivaOwnerImage(owner);
  const displayName = vivaShotgunDisplayName(owner);
  const records = completed.length
    ? `<ul class="shotgun-record-list">${completed.map(completedRecord).join('')}</ul>`
    : '<p class="muted">No completed Shotguns.</p>';
  return `<article class="shotgun-card shotgun-owner-tile"><div class="shotgun-card-header">${identity ? `<img src="${escapeHtml(identity.src)}" alt="${escapeHtml(identity.alt)}" />` : ''}<h3>${escapeHtml(displayName)}</h3></div><div class="shotgun-card-metrics"><span>Owed: ${owedCount}</span><span>Completed: ${completed.length}</span></div>${records}</article>`;
}

function ownerOverviewCard(owner: string, owedCount: number, completedCount: number): string {
  const displayName = vivaShotgunDisplayName(owner);
  return `<li><article class="shotgun-card shotgun-owner-overview-card"><h3>${escapeHtml(displayName)}</h3><dl class="shotgun-card-metrics"><div><dt>Owed</dt><dd>${owedCount}</dd></div><div><dt>Completed</dt><dd>${completedCount}</dd></div><div><dt>Total</dt><dd>${owedCount + completedCount}</dd></div></dl></article></li>`;
}

function owedRecord(row: ShotgunRecord): string {
  return `<li class="shotgun-owed-record"><div><strong>${escapeHtml(vivaShotgunDisplayName(row.owner))}</strong><span>${escapeHtml(row.cause)}</span></div><dl><div><dt>Week</dt><dd>${escapeHtml(row.week ?? '—')}</dd></div><div><dt>Record date</dt><dd>${escapeHtml(row.date)}</dd></div><div><dt>Due date</dt><dd>${escapeHtml(row.due_date || '—')}</dd></div></dl></li>`;
}

export function createFeatureController(): VivaFeatureController {
  let context: AppContext;
  let active = false;
  let rows: ShotgunRecord[] | null = null;
  let root: HTMLElement | null = null;
  let dialog: HTMLDialogElement | null = null;
  let video: HTMLVideoElement | null = null;
  let mediaStatus: HTMLElement | null = null;
  let lastFocused: HTMLElement | null = null;
  let selectedOwner: string | null = null;

  const closeDialog = () => {
    video?.pause();
    if (video) video.removeAttribute('src');
    if (dialog?.open) dialog.close();
    lastFocused?.focus();
  };

  const bindPlayback = () => {
    if (!root || !rows) return;
    root.querySelectorAll<HTMLButtonElement>('.shotgun-play').forEach(button => button.addEventListener('click', () => {
      const row = rows?.find(candidate => candidate.id === button.getAttribute('data-shotgun-id'));
      const source = row?.media_key ? mediaUrl(row.media_key) : null;
      if (!row || !source || !dialog || !video) return;
      lastFocused = button;
      if (mediaStatus) mediaStatus.textContent = '';
      video.src = source;
      dialog.showModal();
      void video.play().catch(() => {
        if (mediaStatus) mediaStatus.textContent = 'This clip could not be played. Check the media origin and try again.';
      });
    }));
  };

  const render = () => {
    if (!root) return;
    if (rows === null) {
      root.innerHTML = '<p class="status-banner status-warning" role="status">Shotguns data is unavailable. The rest of Viva remains available.</p>';
      return;
    }
    const owed = rows.filter(row => !row.completed).sort((a, b) => String(b.due_date || '').localeCompare(String(a.due_date || '')));
    const completed = rows.filter(row => row.completed).sort((a, b) => b.date.localeCompare(a.date));
    const owners = [...new Set(rows.map(row => row.owner))].sort();
    if (selectedOwner && !owners.includes(selectedOwner)) selectedOwner = null;
    const completedOwners = selectedOwner ? owners.filter(owner => owner === selectedOwner) : owners;
    const ownerOverview = owners.map(owner => ownerOverviewCard(owner, owed.filter(row => row.owner === owner).length, completed.filter(row => row.owner === owner).length)).join('');
    const ownerTiles = completedOwners.map(owner => ownerTile(owner, owed.filter(row => row.owner === owner).length, completed.filter(row => row.owner === owner))).join('');
    const filterLabel = selectedOwner ? `Showing ${vivaShotgunDisplayName(selectedOwner)} completed Shotguns` : 'Showing all owners completed Shotguns';
    root.innerHTML = `<section class="shotgun-lead"><div><p class="shotgun-kicker">Viva archive</p><h2 id="shotgunsLeadHeading">Shotguns</h2><p class="shotgun-lead-copy">Track owed consequences and revisit every completed Shotgun.</p></div><div class="shotgun-metrics" aria-label="Shotguns totals"><div class="shotgun-metric"><span>Owed</span><strong>${owed.length}</strong></div><div class="shotgun-metric"><span>Completed</span><strong>${completed.length}</strong></div><div class="shotgun-metric"><span>Total</span><strong>${rows.length}</strong></div></div>${!MEDIA_BASE_URL ? '<p class="status-banner status-warning shotgun-media-notice" role="status">Shotgun media is not configured for this deployment. All records remain available, with unavailable controls explained below.</p>' : ''}</section><section class="card" aria-labelledby="shotgunsByOwnerHeading"><div class="section-heading"><div><h3 id="shotgunsByOwnerHeading">Shotguns by owner</h3><p class="muted">A compact overview of every owner in the archive.</p></div></div><ul class="shotgun-owner-overview">${ownerOverview}</ul></section><section class="card" aria-labelledby="shotgunsOwedHeading"><div class="section-heading"><div><h3 id="shotgunsOwedHeading">Shotguns owed</h3><p class="muted">These records are still awaiting completion.</p></div></div>${owed.length ? `<ul class="shotgun-owed-list">${owed.map(owedRecord).join('')}</ul>` : '<p class="muted">No Shotguns owed.</p>'}</section><section class="card" aria-labelledby="completedShotgunsHeading"><div class="section-heading shotgun-archive-heading"><div><h3 id="completedShotgunsHeading">Completed archive</h3><p id="shotgunFilterStatus" class="muted" role="status" aria-live="polite">${escapeHtml(filterLabel)}</p></div><div class="shotgun-filter"><label for="shotgunOwnerFilter">Filter by owner</label><select id="shotgunOwnerFilter"><option value="">All owners</option>${owners.map(owner => `<option value="${escapeHtml(owner)}">${escapeHtml(vivaShotgunDisplayName(owner))}</option>`).join('')}</select>${selectedOwner ? '<button type="button" class="btn" data-shotgun-clear-filter>Clear filter</button>' : ''}</div></div><div class="shotgun-grid" aria-live="polite">${ownerTiles || `<p class="muted shotgun-empty-state">No completed Shotguns match this owner. <button type="button" class="btn" data-shotgun-clear-filter>Clear filter</button></p>`}</div></section>`;
    const filter = root.querySelector<HTMLSelectElement>('#shotgunOwnerFilter');
    if (filter) {
      filter.value = selectedOwner || '';
      filter.addEventListener('change', () => {
        selectedOwner = filter.value || null;
        render();
        root?.querySelector<HTMLSelectElement>('#shotgunOwnerFilter')?.focus();
      });
    }
    root.querySelectorAll<HTMLButtonElement>('[data-shotgun-clear-filter]').forEach(button => button.addEventListener('click', () => {
      selectedOwner = null;
      render();
      root?.querySelector<HTMLSelectElement>('#shotgunOwnerFilter')?.focus();
    }));
    bindPlayback();
  };

  return {
    id: 'shotguns',
    mount(nextContext) {
      context = nextContext;
      root = context.document.getElementById('shotgunsRoot');
      dialog = context.document.getElementById('shotgunDialog') as HTMLDialogElement | null;
      video = context.document.getElementById('shotgunVideo') as HTMLVideoElement | null;
      mediaStatus = context.document.getElementById('shotgunMediaStatus');
      if (!root || !dialog || !video) throw new Error('Shotguns feature roots missing');
      dialog.querySelector('[data-shotgun-close]')?.addEventListener('click', closeDialog);
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
      video.addEventListener('error', () => {
        if (mediaStatus) mediaStatus.textContent = 'This clip could not be loaded. The rest of the Shotguns archive remains available.';
      });
    },
    activate(input: FeatureActivation) {
      active = !input.signal.aborted;
      rows = context.data.shotguns === null ? null : normalizeRows(context.data.shotguns);
      selectedOwner = null;
      context.header.feature('Shotguns', null, 'Shotguns — Viva');
      context.theme.league();
      render();
    },
    deactivate() { active = false; closeDialog(); },
    dispose() { active = false; closeDialog(); root?.replaceChildren(); root = null; mediaStatus = null; },
  };
}
