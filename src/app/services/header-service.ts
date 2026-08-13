import { renderHeaderBanners, updateTeamHeader } from '../../../js/render-helpers.js';
import type { HeaderService, LeagueDataSnapshot } from '../app-types';
import { resolveVivaOwner, vivaOwnerImage } from '../../viva/owners';

function updateOwnerIdentity(owner: string | null, doc: Document): void {
  const identity = doc.getElementById('headerOwnerIdentity');
  const image = doc.getElementById('headerOwnerImage') as HTMLImageElement | null;
  const fallback = doc.getElementById('headerOwnerFallback');
  const config = owner ? resolveVivaOwner(owner) : null;
  const source = config ? vivaOwnerImage(config.canonical) : null;
  if (!identity || !image || !fallback) return;
  identity.hidden = !config;
  fallback.textContent = config ? config.displayName : '';
  const showFallback = () => {
    fallback.classList.remove('visually-hidden');
    fallback.setAttribute('aria-hidden', 'false');
    image.hidden = true;
    image.alt = '';
  };
  if (source) {
    fallback.classList.add('visually-hidden');
    fallback.setAttribute('aria-hidden', 'true');
    image.onerror = showFallback;
    image.src = source.src;
    image.alt = source.alt;
    image.hidden = false;
  } else {
    image.onerror = null;
    image.removeAttribute('src');
    image.alt = '';
    image.hidden = true;
    showFallback();
  }
}

export function createHeaderService(doc: Document, data: LeagueDataSnapshot): HeaderService {
  return {
    team(owner) {
      updateTeamHeader(owner, data.seasonSummaries, doc);
      updateOwnerIdentity(owner, doc);
    },
    feature(title, owner = null, documentTitle = title) {
      const heading = doc.querySelector('header h2');
      if (heading) heading.textContent = title;
      renderHeaderBanners(owner || '', data.seasonSummaries, doc);
      updateOwnerIdentity(owner, doc);
      doc.title = documentTitle;
    },
  };
}
