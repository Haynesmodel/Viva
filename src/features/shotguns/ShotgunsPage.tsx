import type { VivaShotguns } from '../../data/generated/asset-types';
import { resolveVivaOwner, vivaOwnerImage, vivaShotgunDisplayName } from '../../viva/owners';

type ShotgunRecord = VivaShotguns[number];

function mediaLabel(row: ShotgunRecord, recent: boolean): string {
  return `Play ${vivaShotgunDisplayName(row.owner)}'s Shotgun from ${row.date}: ${row.cause} (record ${row.id})${recent ? ' · Recently complete' : ''}`;
}

function MediaAction({ row, mediaAvailable, onPlay, recent }: { row: ShotgunRecord; mediaAvailable: boolean; onPlay(row: ShotgunRecord): void; recent: boolean }) {
  const owner = vivaShotgunDisplayName(row.owner);
  return <button
    class="btn shotgun-play"
    type="button"
    data-shotgun-id={row.id}
    aria-label={mediaAvailable ? mediaLabel(row, recent) : `Media unavailable for ${owner}'s Shotgun from ${row.date}: ${row.cause} (record ${row.id})${recent ? ' · Recently complete' : ''}`}
    disabled={!mediaAvailable}
    onClick={() => onPlay(row)}
  >
    {mediaAvailable ? 'Play clip' : `Media unavailable for ${owner} · ${row.date} · ${row.cause}`}
  </button>;
}

function RecordDetails({ row, recent = false }: { row: ShotgunRecord; recent?: boolean }) {
  return <div class="shotgun-record-details">
    <strong>{recent ? vivaShotgunDisplayName(row.owner) : row.date}</strong>
    <span>{recent ? row.date : row.week ? `Week ${row.week}` : null}</span>
    {recent && row.week && <span>Week {row.week}</span>}
    <span>{row.cause}</span>
  </div>;
}

function RecordRow({ row, mediaAvailable, onPlay, recent = false }: { row: ShotgunRecord; mediaAvailable: boolean; onPlay(row: ShotgunRecord): void; recent?: boolean }) {
  return <li class="shotgun-record">
    <RecordDetails row={row} recent={recent} />
    <MediaAction row={row} mediaAvailable={mediaAvailable} onPlay={onPlay} recent={recent} />
  </li>;
}

function OwnerOverviewCard({ owner, owedCount, completedCount }: { owner: string; owedCount: number; completedCount: number }) {
  return <li>
    <article class="shotgun-card shotgun-owner-overview-card">
      <h3>{vivaShotgunDisplayName(owner)}</h3>
      <dl class="shotgun-card-metrics">
        <div><dt>Owed</dt><dd>{owedCount}</dd></div>
        <div><dt>Completed</dt><dd>{completedCount}</dd></div>
        <div><dt>Total</dt><dd>{owedCount + completedCount}</dd></div>
      </dl>
    </article>
  </li>;
}

function OwnerTile({ owner, owedCount, completed, mediaAvailable, onPlay }: { owner: string; owedCount: number; completed: ShotgunRecord[]; mediaAvailable: boolean; onPlay(row: ShotgunRecord): void }) {
  const identity = vivaOwnerImage(owner);
  return <article class="shotgun-card shotgun-owner-tile">
    <div class="shotgun-card-header">
      {identity && <img src={identity.src} alt={identity.alt} />}
      <h3>{vivaShotgunDisplayName(owner)}</h3>
    </div>
    <div class="shotgun-card-metrics">
      <span>Owed: {owedCount}</span>
      <span>Completed: {completed.length}</span>
    </div>
    {completed.length
      ? <ul class="shotgun-record-list">{completed.map(row => <RecordRow key={row.id} row={row} mediaAvailable={mediaAvailable} onPlay={onPlay} />)}</ul>
      : <p class="muted">No completed Shotguns.</p>}
  </article>;
}

function OwedRecord({ row }: { row: ShotgunRecord }) {
  return <li class="shotgun-owed-record">
    <div><strong>{vivaShotgunDisplayName(row.owner)}</strong><span>{row.cause}</span></div>
    <dl>
      <div><dt>Week</dt><dd>{row.week ?? '—'}</dd></div>
      <div><dt>Record date</dt><dd>{row.date}</dd></div>
      <div><dt>Due date</dt><dd>{row.due_date || '—'}</dd></div>
    </dl>
  </li>;
}

export interface ShotgunsPageProps {
  rows: ShotgunRecord[];
  owed: ShotgunRecord[];
  completed: ShotgunRecord[];
  owners: string[];
  completedOwners: string[];
  selectedOwner: string | null;
  mediaAvailable: boolean;
  onOwnerChange(owner: string | null): void;
  onClearFilter(): void;
  onPlay(row: ShotgunRecord): void;
}

export function ShotgunsPage({ rows, owed, completed, owners, completedOwners, selectedOwner, mediaAvailable, onOwnerChange, onClearFilter, onPlay }: ShotgunsPageProps) {
  const ownerCompleted = (owner: string) => completed.filter(row => row.owner === owner);
  const ownerOwed = (owner: string) => owed.filter(row => row.owner === owner).length;
  return <>
    <section class="shotgun-lead">
      <div>
        <p class="shotgun-kicker">Viva archive</p>
        <h2 id="shotgunsLeadHeading">Shotguns</h2>
        <p class="shotgun-lead-copy">Track owed consequences and revisit every completed Shotgun.</p>
      </div>
      <div class="shotgun-metrics" aria-label="Shotguns totals">
        <div class="shotgun-metric"><span>Owed</span><strong>{owed.length}</strong></div>
        <div class="shotgun-metric"><span>Completed</span><strong>{completed.length}</strong></div>
        <div class="shotgun-metric"><span>Total</span><strong>{rows.length}</strong></div>
      </div>
      {!mediaAvailable && <p class="status-banner status-warning shotgun-media-notice" role="status">Shotgun media is not configured for this deployment. All records remain available, with unavailable controls explained below.</p>}
    </section>

    <section class="card" aria-labelledby="shotgunsByOwnerHeading">
      <div class="section-heading"><div><h3 id="shotgunsByOwnerHeading">Shotguns by owner</h3><p class="muted">A compact overview of every owner in the archive.</p></div></div>
      <ul class="shotgun-owner-overview">{owners.map(owner => <OwnerOverviewCard key={owner} owner={owner} owedCount={ownerOwed(owner)} completedCount={ownerCompleted(owner).length} />)}</ul>
    </section>

    <section class="card" aria-labelledby="shotgunsOwedHeading">
      <div class="section-heading"><div><h3 id="shotgunsOwedHeading">Shotguns owed</h3><p class="muted">These records are still awaiting completion.</p></div></div>
      {owed.length ? <ul class="shotgun-owed-list">{owed.map(row => <OwedRecord key={row.id} row={row} />)}</ul> : <p class="muted">No Shotguns owed.</p>}
    </section>

    <section class="card" aria-labelledby="recentShotgunsHeading">
      <div class="section-heading"><div><h3 id="recentShotgunsHeading">Recently complete</h3><p class="muted">The five most recently completed Shotguns.</p></div></div>
      {completed.length
        ? <ul class="shotgun-record-list" aria-live="polite">{completed.slice(0, 5).map(row => <RecordRow key={row.id} row={row} mediaAvailable={mediaAvailable} onPlay={onPlay} recent />)}</ul>
        : <p class="muted">No completed Shotguns.</p>}
    </section>

    <section class="card" aria-labelledby="completedShotgunsHeading">
      <div class="section-heading shotgun-archive-heading">
        <div><h3 id="completedShotgunsHeading">Completed archive</h3><p id="shotgunFilterStatus" class="muted" role="status" aria-live="polite">{selectedOwner ? `Showing ${vivaShotgunDisplayName(selectedOwner)} completed Shotguns` : 'Showing all owners completed Shotguns'}</p></div>
        <div class="shotgun-filter">
          <label for="shotgunOwnerFilter">Filter by owner</label>
          <select id="shotgunOwnerFilter" value={selectedOwner || ''} onChange={event => onOwnerChange(event.currentTarget.value || null)}>
            <option value="">All owners</option>
            {owners.map(owner => <option value={owner} key={owner}>{vivaShotgunDisplayName(owner)}</option>)}
          </select>
          {selectedOwner && <button type="button" class="btn" data-shotgun-clear-filter onClick={onClearFilter}>Clear filter</button>}
        </div>
      </div>
      <div class="shotgun-grid" aria-live="polite">
        {completedOwners.length
          ? completedOwners.map(owner => <OwnerTile key={owner} owner={owner} owedCount={ownerOwed(owner)} completed={ownerCompleted(owner)} mediaAvailable={mediaAvailable} onPlay={onPlay} />)
          : <p class="muted shotgun-empty-state">No completed Shotguns match this owner. <button type="button" class="btn" data-shotgun-clear-filter onClick={onClearFilter}>Clear filter</button></p>}
      </div>
    </section>
  </>;
}

export function normalizeShotgunRows(rows: ShotgunRecord[] | null): ShotgunRecord[] {
  return Array.isArray(rows) ? rows.filter(row => resolveVivaOwner(row.owner)) : [];
}
