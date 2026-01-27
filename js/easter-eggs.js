
// Group overlays + persistent backdrops
(function(){
    // ensure overlay container
    function ensureFxOverlay(){
      let fx = document.getElementById('fxGroup');
      if(!fx){
        fx = document.createElement('div');
        fx.id = 'fxGroup';
        document.body.appendChild(fx);
      }
      return fx;
    }
    // ensure persistent background container
    function ensureFxBackdrop(){
      let bg = document.getElementById('groupBg');
      if(!bg){
        bg = document.createElement('div');
        bg.id = 'groupBg';
        bg.className = 'egg-backdrop';
        document.body.insertBefore(bg, document.body.firstChild);
      }
      return bg;
    }
  
    const GROUP_EGGS = {
      'texans':               { cls: 'egg-texans', label: 'Texans 🤠', emoji: '🤠' },
      'married-to-each-other':{ cls: 'egg-married', label: 'Married 💍', emoji: '💖' },
      'guns':                 { cls: 'egg-guns', label: 'Guns 🔫', emoji: '🔫' },
      'depauw-tigers':        { cls: 'egg-depauw', label: 'DePauw (Tigers) 🐯', emoji: '🐯' },
      'kappa-kappa-gamma':    { cls: 'egg-kkg', label: 'Kappa Kappa Gamma ✨', emoji: '✨' },
      'fiji':                 { cls: 'egg-fiji', label: 'Fiji 🌺', emoji: '🌺' },
      'former-champs':        { cls: 'egg-former-champs', label: 'Former Champs 🏆', emoji: '🏆' },
      'former-last-place':    { cls: 'egg-last-place', label: 'Former Last Place 🪦', emoji: '🪦' },
      'park-city-skiers':     { cls: 'egg-skiers', label: 'Park City Skiers 🎿', emoji: '🎿' }
    };
  
    // one-shot celebratory overlay
    window.triggerGroupEgg = function(slug){
      const egg = GROUP_EGGS[slug]; if(!egg) return;
      const fx = ensureFxOverlay();
      const ov = document.createElement('div');
      ov.className = 'egg-overlay ' + egg.cls;
  
      const lbl = document.createElement('div');
      lbl.className = (slug === 'birds-clinch') ? 'clinch-stamp' : 'egg-label';
      lbl.textContent = egg.label || slug;
      ov.appendChild(lbl);
  
      fx.appendChild(ov);
      setTimeout(()=>{ ov.classList.add('hide'); setTimeout(()=>ov.remove(), 600); }, 2200);
    };
  
    // persistent animated background (until changed/cleared)
    window.setGroupBackdrop = function(slugOrNull){
      const bg = ensureFxBackdrop();
      // reset classes and contents
      bg.className = 'egg-backdrop';
      bg.innerHTML = '';
      document.body.classList.remove('group-active');
  
      if(!slugOrNull){ return; }
  
      const egg = GROUP_EGGS[slugOrNull];
      const cls = egg ? egg.cls : null;
      if(cls){
        // add a stable class per group
        bg.classList.add('bg-'+slugOrNull);
        document.body.classList.add('group-active');
        // add a handful of floating emoji for flash
        const emo = egg.emoji || '✨';
        for(let i=0;i<14;i++){
          const e = document.createElement('i');
          e.className = 'float';
          e.textContent = emo;
          e.style.left = (Math.random()*100)+'vw';
          e.style.animationDelay = (Math.random()*2)+'s';
          e.style.fontSize = (28 + Math.random()*20) + 'px';
          bg.appendChild(e);
        }
      }
    };
  })();