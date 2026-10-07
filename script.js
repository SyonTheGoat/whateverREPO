(() => {
  const canvas = document.querySelector('#game-canvas');
  const ctx = canvas.getContext('2d');
  const list = document.querySelector('#challenge-list');
  const modes = {
    penalty: { label: 'FINISH', title: 'Penalty', hint: 'Click inside the goal to place your shot.', icon: '⌖' },
    freekick: { label: 'BEND', title: 'Free kick', hint: 'Click a spot around the wall to bend it in.', icon: '⌁' },
    keeper: { label: 'KEEP', title: 'Goalkeeper', hint: 'Click the incoming ball before it crosses the line.', icon: '◉' },
    dribble: { label: 'PACE', title: 'Dribble run', hint: 'Use ← / → or click a lane to beat the defender.', icon: '⇄' },
    target: { label: 'PRECISION', title: 'Target practice', hint: 'Click the highlighted target in the goal.', icon: '◎' }
  };
  const nameA = ['Last-Minute', 'Top-Corner', 'Derby-Night', 'Golden-Boot', 'Away-Day', 'Counter-Attack', 'Final-Whistle', 'First-Touch', 'No-Look', 'Pressure-Cooker', 'Stoppage-Time', 'Lightning'];
  const nameB = ['Finish', 'Curl', 'Save', 'Sprint', 'Bullseye', 'Breakaway', 'Volley', 'Comeback', 'Showdown', 'Rivalry', 'Rockets', 'Run'];
  const challenges = Array.from({ length: 200 }, (_, index) => {
    const modeKey = Object.keys(modes)[index % 5];
    const tier = Math.floor(index / 40) + 1;
    const name = `${nameA[(index * 7 + tier) % nameA.length]} ${nameB[(index * 5 + tier * 3) % nameB.length]}`;
    return { id: index + 1, mode: modeKey, tier, name, target: 3 + (tier % 3), pressure: Math.min(4, tier), seed: index * 19 + 7 };
  });
  const state = { selected: challenges[0], active: false, attempts: 0, score: 0, roundScore: 0, filter: 'all', shown: 10, query: '', target: { x: .75, y: .33 }, keeperX: .5, ball: null, lane: 1, progress: 0, gates: [], lastShot: null, animation: 0 };
  const elements = {
    title: document.querySelector('#current-title'), number: document.querySelector('#challenge-number'),
    hintTitle: document.querySelector('#instruction-title'), hint: document.querySelector('#instruction-copy'), icon: document.querySelector('#control-icon'),
    status: document.querySelector('#status-message'), round: document.querySelector('#round-count'), badge: document.querySelector('#stage-badge'), start: document.querySelector('#start-button'),
    best: document.querySelector('#best-score'), count: document.querySelector('#mission-count'), search: document.querySelector('#challenge-search')
  };
  let best = Number(localStorage.getItem('mbappe-arcade-best') || 0);
  elements.best.textContent = String(best).padStart(3, '0');

  function drawPitch() {
    const w = canvas.width, h = canvas.height;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#111916'); sky.addColorStop(.53, '#20352b'); sky.addColorStop(.54, '#1b4b31'); sky.addColorStop(1, '#102c20');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 5; row++) { ctx.fillStyle = `rgba(7,12,10,${.23 + row * .045})`; ctx.fillRect(0, 32 + row * 16, w, 9); }
    for (let x = 42; x < w; x += 90) { ctx.fillStyle = 'rgba(226,243,196,.19)'; ctx.beginPath(); ctx.arc(x, 26, 2 + (x % 3), 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? 'rgba(8,32,20,.12)' : 'rgba(146,206,101,.045)'; ctx.fillRect(i * w / 8, h * .48, w / 8, h * .52); }
    ctx.strokeStyle = 'rgba(227,241,216,.38)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h * .57); ctx.lineTo(w, h * .57); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w / 2, h * .57, w * .09, h * .11, 0, 0, Math.PI * 2); ctx.stroke();
    const gx = w * .28, gy = h * .18, gw = w * .44, gh = h * .30;
    ctx.fillStyle = 'rgba(220,232,218,.06)'; ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(235,244,232,.32)'; ctx.lineWidth = 1;
    for (let i = 1; i < 11; i++) { ctx.beginPath(); ctx.moveTo(gx + gw * i / 11, gy); ctx.lineTo(gx + gw * i / 11, gy + gh); ctx.stroke(); }
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(gx, gy + gh * i / 6); ctx.lineTo(gx + gw, gy + gh * i / 6); ctx.stroke(); }
    ctx.strokeStyle = '#ecf3e8'; ctx.lineWidth = 5; ctx.strokeRect(gx, gy, gw, gh);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(239,244,229,.45)'; ctx.strokeRect(w * .19, h * .12, w * .62, h * .38);
    return { gx, gy, gw, gh };
  }

  function drawGoalie(x, y, scale = 1, diving = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    if (diving) ctx.rotate(-.48);
    ctx.fillStyle = '#e5ef56'; ctx.beginPath(); ctx.roundRect(-19, -43, 38, 39, 8); ctx.fill();
    ctx.fillStyle = '#c99c78'; ctx.beginPath(); ctx.arc(0, -52, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e5ef56'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, -32); ctx.lineTo(-31, -18); ctx.moveTo(14, -32); ctx.lineTo(31, -18); ctx.stroke();
    ctx.fillStyle = '#eff4e9'; ctx.beginPath(); ctx.arc(-33, -17, 5, 0, Math.PI * 2); ctx.arc(33, -17, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e5ef56'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-13, 15); ctx.moveTo(10, -5); ctx.lineTo(13, 15); ctx.stroke();
    ctx.restore();
  }

  function drawBall(x, y, r = 11) {
    ctx.save(); ctx.shadowColor = '#0009'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#f2f1e9'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#20251f'; ctx.beginPath(); ctx.arc(x, y, r * .43, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#34392f'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r * .72, -.4, 1.2); ctx.stroke(); ctx.restore();
  }

  function drawScene() {
    const { gx, gy, gw, gh } = drawPitch();
    const c = state.selected;
    if (!c) return;
    if (c.mode === 'dribble') {
      const lanes = [w => w * .33, w => w * .5, w => w * .67];
      const laneX = lanes[state.lane](canvas.width);
      for (let i = 0; i < 3; i++) {
        const x = lanes[i](canvas.width);
        ctx.strokeStyle = 'rgba(239,244,229,.18)'; ctx.setLineDash([7, 8]); ctx.beginPath(); ctx.moveTo(x, canvas.height * .57); ctx.lineTo(x, canvas.height * .95); ctx.stroke(); ctx.setLineDash([]);
        if (state.active || state.progress) {
          const blocked = (i === (state.selected.seed + state.progress) % 3);
          if (blocked) { ctx.fillStyle = '#ff735d'; ctx.beginPath(); ctx.arc(x, canvas.height * (.77 - state.progress * .025), 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe6db'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, canvas.height * (.77 - state.progress * .025) + 3); }
        }
      }
      if (state.active) drawBall(laneX, canvas.height * .91, 12);
      const width = canvas.width;
      ctx.fillStyle = 'rgba(8,12,10,.7)'; ctx.fillRect(width * .35, canvas.height * .05, width * .3, 24);
      ctx.fillStyle = '#d6f34a'; ctx.fillRect(width * .36, canvas.height * .05 + 4, width * .28 * Math.min(1, state.progress / 5), 16);
      ctx.fillStyle = '#f2f1e9'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SPRINT METER', width * .5, canvas.height * .05 + 15);
      return;
    }
    if (c.mode === 'keeper') {
      const bx = state.ball?.x ?? gx + gw * state.target.x;
      const by = state.ball?.y ?? gy + gh * state.target.y;
      drawGoalie(state.keeperX * canvas.width, gy + gh * .83, .9);
      drawBall(bx, by, 13);
      ctx.fillStyle = 'rgba(17,22,18,.7)'; ctx.fillRect(gx, gy + gh + 12, gw, 25);
      ctx.fillStyle = '#d6f34a'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CLICK THE BALL TO MAKE THE SAVE', canvas.width / 2, gy + gh + 29);
      return;
    }
    if (c.mode === 'freekick') {
      const wallY = hline(canvas.height, .57);
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = '#e9e9db'; ctx.fillRect(canvas.width * (.5 + i * .038) - 8, wallY - 28, 16, 28);
        ctx.fillStyle = '#c99c78'; ctx.beginPath(); ctx.arc(canvas.width * (.5 + i * .038), wallY - 35, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawGoalie(state.keeperX * canvas.width, gy + gh * .83, 1, Boolean(state.lastShot && !state.lastShot.goal));
    if (c.mode === 'target' || c.mode === 'penalty' || c.mode === 'freekick') {
      const tx = gx + gw * state.target.x, ty = gy + gh * state.target.y;
      ctx.strokeStyle = 'rgba(214,243,74,.88)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, c.mode === 'target' ? 18 : 13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(214,243,74,.11)'; ctx.beginPath(); ctx.arc(tx, ty, c.mode === 'target' ? 18 : 13, 0, Math.PI * 2); ctx.fill();
      if (state.lastShot) drawBall(state.lastShot.x, state.lastShot.y, 10);
    }
    const label = c.mode === 'freekick' ? 'WALL' : 'GOAL';
    ctx.fillStyle = 'rgba(17,22,18,.72)'; ctx.fillRect(gx + 8, gy + 8, 38, 17);
    ctx.fillStyle = '#d6f34a'; ctx.font = '700 8px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, gx + 14, gy + 20);
  }
  function hline(h, part) { return h * part; }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width); canvas.height = Math.round(rect.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawScene();
  }

  function setStatus(text) { elements.status.textContent = text; }
  function renderChallenges() {
    const filtered = challenges.filter(ch => (state.filter === 'all' || ch.mode === state.filter) && `${ch.name} ${modes[ch.mode].title} ${String(ch.id).padStart(3, '0')}`.toLowerCase().includes(state.query));
    elements.count.textContent = filtered.length;
    const page = filtered.slice(0, state.shown);
    list.innerHTML = page.map(ch => `<button class="challenge-card${ch.id === state.selected.id ? ' active' : ''}" data-id="${ch.id}" aria-label="Challenge ${ch.id}: ${ch.name}, ${modes[ch.mode].title}"><span class="mission-index">${String(ch.id).padStart(3, '0')}</span><span class="mission-info"><b>${ch.name}</b><small>LEVEL ${ch.tier} · ${ch.target} ${ch.mode === 'dribble' ? 'GATES' : 'ROUNDS'}</small></span><span class="mission-mode">${modes[ch.mode].label}</span></button>`).join('');
    document.querySelector('#load-more').hidden = filtered.length <= state.shown;
    list.querySelectorAll('.challenge-card').forEach(button => button.addEventListener('click', () => selectChallenge(Number(button.dataset.id))));
  }

  function selectChallenge(id) {
    state.selected = challenges[id - 1]; state.active = false; state.attempts = 0; state.roundScore = 0; state.progress = 0; state.lastShot = null; state.ball = null;
    const mode = modes[state.selected.mode];
    elements.title.textContent = state.selected.name.toUpperCase();
    elements.number.textContent = `CHALLENGE ${String(id).padStart(3, '0')}`;
    elements.hintTitle.textContent = mode.title;
    elements.hint.textContent = mode.hint;
    elements.icon.textContent = mode.icon;
    elements.start.textContent = 'KICK OFF →';
    elements.round.textContent = `0 / ${state.selected.target}`;
    elements.badge.textContent = 'READY WHEN YOU ARE';
    setStatus(`Level ${state.selected.tier} · ${mode.title} challenge. Ready?`);
    state.target = { x: .68 + ((state.selected.seed % 22) / 100), y: .23 + ((state.selected.seed % 45) / 100) };
    state.keeperX = .45 + ((state.selected.seed % 12) / 100);
    renderChallenges(); drawScene();
  }

  function startChallenge() {
    if (state.active) { state.active = false; state.attempts = 0; state.roundScore = 0; state.progress = 0; state.lastShot = null; state.ball = null; }
    state.active = true; state.attempts = 0; state.roundScore = 0; state.progress = 0; state.lastShot = null;
    elements.start.textContent = 'RESET RUN ↻'; elements.badge.textContent = 'CHALLENGE LIVE';
    setStatus(state.selected.mode === 'keeper' ? 'Shot incoming — click the ball to block it!' : state.selected.mode === 'dribble' ? 'Pick a lane. Watch the defender and keep moving!' : 'Take your shot. Make every touch count.');
    if (state.selected.mode === 'keeper') launchKeeperShot();
    drawScene();
  }

  function finishRun(won, message) {
    state.active = false; state.ball = null; elements.start.textContent = 'PLAY AGAIN ↻';
    elements.badge.textContent = won ? 'CHALLENGE CLEARED' : 'RUN COMPLETE';
    const points = won ? state.roundScore + state.selected.tier * 25 : state.roundScore;
    state.score += points; setStatus(`${message}  +${points} points this run.`);
    if (state.score > best) { best = state.score; localStorage.setItem('mbappe-arcade-best', String(best)); elements.best.textContent = String(best).padStart(3, '0'); }
    drawScene();
  }

  function takeShot(point) {
    const c = state.selected, w = canvas.width, h = canvas.height;
    const gx = w * .28, gy = h * .18, gw = w * .44, gh = h * .3;
    const inside = point.x >= gx && point.x <= gx + gw && point.y >= gy && point.y <= gy + gh;
    const nx = (point.x - gx) / gw, ny = (point.y - gy) / gh;
    const isWall = c.mode === 'freekick' && Math.abs(point.x - w * .5) < w * .08 && point.y > h * .38;
    const saveDistance = Math.hypot(nx - state.keeperX, ny - .73);
    const scored = inside && !isWall && saveDistance > (.13 + c.pressure * .012);
    state.lastShot = { x: point.x, y: point.y, goal: scored };
    state.attempts++;
    if (scored) { state.roundScore += c.mode === 'target' ? 150 : c.mode === 'freekick' ? 130 : 100; setStatus(c.mode === 'target' ? 'Bullseye! Clean contact.' : 'GOAL! Keeper beaten.'); }
    else setStatus(!inside ? 'Over the bar — keep it inside the frame.' : isWall ? 'The wall got in the way. Bend it around.' : 'Saved! Pick a corner away from the keeper.');
    elements.round.textContent = `${state.attempts} / ${c.target}`;
    state.keeperX = .22 + ((c.seed + state.attempts * 17) % 57) / 100;
    if (state.attempts >= c.target) finishRun(state.roundScore >= c.target * (c.mode === 'target' ? 120 : 80), state.roundScore ? 'Full time!' : 'Final whistle.');
    drawScene();
  }

  function launchKeeperShot() {
    const c = state.selected;
    const { width: w, height: h } = canvas;
    state.ball = { x: w * (.35 + (c.seed % 30) / 100), y: h * .26, tx: w * (.34 + ((c.seed * 3) % 36) / 100), ty: h * .43, born: performance.now() };
    state.target = { x: (state.ball.tx / w - .28) / .44, y: (state.ball.ty / h - .18) / .3 };
    state.keeperX = .5;
    requestAnimationFrame(animateKeeper);
  }
  function animateKeeper(now) {
    if (!state.active || state.selected.mode !== 'keeper' || !state.ball) return;
    const t = Math.min(1, (now - state.ball.born) / 1400);
    state.ball.x = canvas.width * (.35 + (state.selected.seed % 30) / 100) + (state.ball.tx - canvas.width * (.35 + (state.selected.seed % 30) / 100)) * t;
    state.ball.y = canvas.height * .26 + (state.ball.ty - canvas.height * .26) * t;
    drawScene();
    if (t >= 1) { state.attempts++; elements.round.textContent = `${state.attempts} / ${state.selected.target}`; state.ball = null; setStatus('Too late — the shot crossed the line.'); if (state.attempts >= state.selected.target) finishRun(false, 'The striker found a way through.'); else setTimeout(() => state.active && launchKeeperShot(), 650); }
    else requestAnimationFrame(animateKeeper);
  }

  function handlePoint(point) {
    if (!state.active) return;
    const c = state.selected;
    if (c.mode === 'dribble') {
      const lane = Math.max(0, Math.min(2, Math.round((point.x / canvas.width - .33) / .17)));
      const blocked = lane === (c.seed + state.progress) % 3;
      if (blocked) { setStatus('Defender closed that lane! Reset and find the gap.'); finishRun(false, 'Tackled.'); return; }
      state.lane = lane; state.progress++; state.roundScore += 40;
      elements.round.textContent = `${state.progress} / ${c.target}`;
      if (state.progress >= c.target) finishRun(true, 'Defender beaten. What a run!'); else setStatus('Space found. Change lane and keep accelerating.');
      drawScene(); return;
    }
    if (c.mode === 'keeper') {
      if (!state.ball) return;
      const distance = Math.hypot(point.x - state.ball.x, point.y - state.ball.y);
      if (distance < Math.max(35, canvas.width * .065)) {
        state.attempts++; state.roundScore += 110; state.ball = null;
        elements.round.textContent = `${state.attempts} / ${c.target}`;
        setStatus('Great reflexes! Shot stopped. Set for the next one.');
        if (state.attempts >= c.target) finishRun(true, 'Clean sheet!'); else setTimeout(() => state.active && launchKeeperShot(), 700);
      } else setStatus('Reach the ball! Click closer to the shot.');
      drawScene(); return;
    }
    takeShot(point);
  }

  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    handlePoint({ x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height });
  });
  document.addEventListener('keydown', event => {
    if (!state.active || state.selected.mode !== 'dribble' || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    state.lane = Math.max(0, Math.min(2, state.lane + (event.key === 'ArrowLeft' ? -1 : 1)));
    const x = canvas.width * [.33, .5, .67][state.lane];
    handlePoint({ x, y: canvas.height * .75 });
  });
  elements.start.addEventListener('click', startChallenge);
  elements.search.addEventListener('input', () => { state.query = elements.search.value.trim().toLowerCase(); state.shown = 10; renderChallenges(); });
  document.querySelectorAll('.filter-chip').forEach(chip => chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(item => item.classList.remove('selected'));
    chip.classList.add('selected'); state.filter = chip.dataset.filter; state.shown = 10; renderChallenges();
  }));
  document.querySelector('#load-more').addEventListener('click', () => { state.shown += 10; renderChallenges(); });
  new ResizeObserver(resizeCanvas).observe(canvas);
  selectChallenge(1);
  renderChallenges();
  resizeCanvas();
})();