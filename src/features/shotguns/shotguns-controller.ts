import './shotguns.entry.css';
import { h, render } from 'preact';
import type { AppContext } from '../../app/app-types';
import type { VivaFeatureController, FeatureActivation } from '../../app/feature-contract';
import type { VivaShotguns } from '../../data/generated/asset-types';
import { ShotgunsPage, normalizeShotgunRows } from './ShotgunsPage';

type ShotgunRecord = VivaShotguns[number];
const MEDIA_BASE_URL = String(import.meta.env.VITE_VIVA_MEDIA_BASE_URL || '').replace(/\/$/, '');

function mediaUrl(key: string): string | null {
  if (!MEDIA_BASE_URL || !/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) return null;
  return `${MEDIA_BASE_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function createFeatureController(): VivaFeatureController {
  let context: AppContext;
  let root: HTMLElement | null = null;
  let dialog: HTMLDialogElement | null = null;
  let video: HTMLVideoElement | null = null;
  let mediaStatus: HTMLElement | null = null;
  let lastFocused: HTMLElement | null = null;
  let selectedOwner: string | null = null;
  let rows: ShotgunRecord[] | null = null;

  const closeDialog = () => {
    video?.pause();
    if (video) video.removeAttribute('src');
    if (dialog?.open) dialog.close();
    lastFocused?.focus();
  };

  const play = (row: ShotgunRecord) => {
    const source = row.media_key ? mediaUrl(row.media_key) : null;
    if (!source || !dialog || !video) return;
    lastFocused = context.document.activeElement as HTMLElement | null;
    if (mediaStatus) mediaStatus.textContent = '';
    video.src = source;
    dialog.showModal();
    void video.play().catch(() => {
      if (mediaStatus) mediaStatus.textContent = 'This clip could not be played. Check the media origin and try again.';
    });
  };

  const renderCurrent = () => {
    if (!root || rows === null) {
      if (root) render(h('p', { class: 'status-banner status-warning', role: 'status' }, 'Shotguns data is unavailable. The rest of Viva remains available.'), root);
      return;
    }
    const owed = rows.filter(row => !row.completed).sort((a, b) => String(b.due_date || '').localeCompare(String(a.due_date || '')));
    const completed = rows.filter(row => row.completed).sort((a, b) => b.date.localeCompare(a.date));
    const owners = [...new Set(rows.map(row => row.owner))].sort();
    if (selectedOwner && !owners.includes(selectedOwner)) selectedOwner = null;
    const completedOwners = owners
      .filter(owner => completed.some(row => row.owner === owner))
      .sort((a, b) => String(completed.find(row => row.owner === b)?.date || '').localeCompare(String(completed.find(row => row.owner === a)?.date || '')) || a.localeCompare(b))
      .filter(owner => !selectedOwner || owner === selectedOwner);
    render(h(ShotgunsPage, {
      rows,
      owed,
      completed,
      owners,
      completedOwners,
      selectedOwner,
      mediaAvailable: Boolean(MEDIA_BASE_URL),
      onOwnerChange: owner => { selectedOwner = owner; renderCurrent(); },
      onClearFilter: () => { selectedOwner = null; renderCurrent(); },
      onPlay: play,
    }), root);
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
      rows = context.data.shotguns === null ? null : normalizeShotgunRows(context.data.shotguns);
      selectedOwner = null;
      context.header.feature('Shotguns', null, 'Shotguns — Viva');
      context.theme.league();
      renderCurrent();
    },
    deactivate() { closeDialog(); },
    dispose() { closeDialog(); if (root) render(null, root); root = null; mediaStatus = null; rows = null; },
  };
}
