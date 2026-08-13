// Viva-only group easter eggs. The module deliberately has no product data.
const GROUP_EGGS = {
  texans: ['Texans 🤠', '🤠'],
  'married-to-each-other': ['Married 💍', '💖'],
  guns: ['Guns 🔫', '🔫'],
  'depauw-tigers': ['DePauw Tigers 🐯', '🐯'],
  'kappa-kappa-gamma': ['Kappa Kappa Gamma ✨', '✨'],
  fiji: ['Fiji 🌺', '🌺'],
  'former-champs': ['Former Champs 🏆', '🏆'],
  'former-last-place': ['Former Last Place 🪦', '🪦'],
  'park-city-skiers': ['Park City Skiers 🎿', '🎿'],
};

function ensureBackdrop() {
  let backdrop = document.getElementById('groupBg');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'groupBg';
    backdrop.className = 'egg-backdrop';
    document.body.prepend(backdrop);
  }
  return backdrop;
}

function triggerGroupEgg(slug) {
  const egg = GROUP_EGGS[slug];
  if (!egg) return;
  const overlay = document.createElement('div');
  overlay.className = `egg-overlay egg-${slug}`;
  overlay.textContent = egg[0];
  document.getElementById('fxGroup')?.append(overlay);
  window.setTimeout(() => overlay.remove(), 2400);
}

function setGroupBackdrop(slug) {
  const backdrop = ensureBackdrop();
  backdrop.className = `egg-backdrop ${slug ? `bg-${slug}` : ''}`;
  backdrop.replaceChildren();
  const egg = GROUP_EGGS[slug];
  if (!egg) return;
  for (let index = 0; index < 14; index += 1) {
    const item = document.createElement('i');
    item.className = 'float';
    item.textContent = egg[1];
    item.style.left = `${Math.random() * 100}vw`;
    item.style.animationDelay = `${Math.random() * 2}s`;
    backdrop.append(item);
  }
}

export { setGroupBackdrop, triggerGroupEgg };
