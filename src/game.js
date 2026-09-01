// Game with Smash Bros-style knockoff mechanic
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GRAVITY = 0.9;
  const FRICTION = 0.85;

  // Platforms: x, y, w, h
  const platforms = [
    { x: 0, y: HEIGHT - 40, w: WIDTH, h: 40 },
    { x: 240, y: 360, w: 200, h: 18 },
    { x: 580, y: 300, w: 180, h: 18 }
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  class Player {
    constructor(x, color, controls) {
      this.x = x;
      this.y = 0;
      this.w = 44;
      this.h = 60;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.facing = 1;
      this.color = color;

      this.damage = 0; // Smash Bros style damage %

      this.attackCooldown = 0;
      this.attackDuration = 0;
      this.stun = 0;

      this.controls = controls;
      this.input = { left: false, right: false, up: false, attack: false };

      this.score = 0;
    }

    rect() {
      return { x: this.x - this.w/2, y: this.y - this.h, w: this.w, h: this.h };
    }

    update() {
      if (this.stun > 0) this.stun--;
      if (!this.stun) {
        if (this.input.left) { this.vx = clamp(this.vx - 1.2, -8, 8); this.facing = -1; }
        else if (this.input.right) { this.vx = clamp(this.vx + 1.2, -8, 8); this.facing = 1; }
        else this.vx *= FRICTION;
      } else {
        this.vx *= 0.95;
      }

      if (this.input.up && this.onGround && !this.stun) {
        this.vy = -18;
        this.onGround = false;
      }

      this.vy += GRAVITY;
      this.vy = clamp(this.vy, -30, 30);

      this.x += this.vx;
      this.y += this.vy;

      this.x = clamp(this.x, this.w/2, WIDTH - this.w/2);

      this.onGround = false;
      const r = this.rect();
      for (const p of platforms) {
        if (r.x < p.x + p.w && r.x + r.w > p.x &&
            r.y < p.y + p.h && r.y + r.h > p.y) {
          if (this.vy >= 0 && (r.y + r.h) - this.vy <= p.y + p.h) {
            this.y = p.y;
            this.vy = 0;
            this.onGround = true;
          } else {
            if (r.x < p.x) this.x = p.x - this.w/2;
            else this.x = p.x + p.w + this.w/2;
            this.vx = 0;
          }
        }
      }

      if (this.attackCooldown > 0) this.attackCooldown--;
      if (this.attackDuration > 0) this.attackDuration--;
    }

    startAttack() {
      if (this.attackCooldown === 0 && this.attackDuration === 0 && !this.stun) {
        this.attackDuration = 12;
        this.attackCooldown = 36;
      }
    }

    getAttackHitbox() {
      if (this.attackDuration > 0) {
        const offset = 10;
        const w = 38;
        const h = 28;
        const hx = this.x + this.facing * (this.w/2 + offset);
        const hy = this.y - this.h/2;
        return { x: hx - w/2, y: hy - h/2, w, h };
      }
      return null;
    }

    isOffScreen() {
      return this.y > HEIGHT + 100;
    }
  }

  // --- Menu / Match flow state ---
  let matchActive = false;
  const overlay = document.getElementById('menuOverlay');
  const startScreen = document.getElementById('startScreen');

  const btnStart = document.getElementById('btnStart');

  // Create players
  const player1 = new Player(200, '#63c2ff', {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', attack: 'KeyS'
  });
  const player2 = new Player(760, '#ff8b8b', {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', attack: 'ArrowDown'
  });

  let players = [player1, player2];

  // Input handling
  const keyMap = {};
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && matchActive) restartRound();
    keyMap[e.code] = true;
    updateInputsFromKeys();
    
    if (matchActive) {
      if (e.code === player1.controls.attack) player1.startAttack();
      if (e.code === player2.controls.attack) player2.startAttack();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    keyMap[e.code] = false;
    updateInputsFromKeys();
  });

  function updateInputsFromKeys() {
    if (!matchActive) return;
    for (const p of players) {
      p.input.left = !!keyMap[p.controls.left];
      p.input.right = !!keyMap[p.controls.right];
      p.input.up = !!keyMap[p.controls.up];
    }
  }

  // Game state
  let winner = null;
  let freeze = 0;

  function restartRound() {
    player1.x = 200; player1.y = 0; player1.vx = 0; player1.vy = 0; player1.damage = 0; player1.stun = 0;
    player2.x = 760; player2.y = 0; player2.vx = 0; player2.vy = 0; player2.damage = 0; player2.stun = 0;
    winner = null;
    freeze = 0;
  }

  function applyAttack(attacker, defender, hitbox) {
    if (!hitbox) return;
    const d = defender.rect();
    if (hitbox.x < d.x + d.w && hitbox.x + hitbox.w > d.x &&
        hitbox.y < d.y + d.h && hitbox.y + hitbox.h > d.y) {
      const baseDamage = 10;
      defender.damage = Math.min(999, defender.damage + baseDamage);
      
      const knockScale = 1 + (defender.damage / 100) * 0.8;
      const knock = (8 + baseDamage / 2) * knockScale;
      
      defender.vx = attacker.facing * knock;
      defender.vy = -6;
      defender.stun = 16;
      freeze = 6;
    }
  }

  function update() {
    if (!matchActive) return;
    if (freeze > 0) { freeze--; return; }

    for (const p of players) p.update();

    const hb1 = player1.getAttackHitbox();
    const hb2 = player2.getAttackHitbox();
    applyAttack(player1, player2, hb1);
    applyAttack(player2, player1, hb2);

    // Win check - Smash Bros style: knock opponent off screen
    if (player1.isOffScreen() && !player2.isOffScreen()) { winner = 2; player2.score++; }
    else if (player2.isOffScreen() && !player1.isOffScreen()) { winner = 1; player1.score++; }
    else if (player1.isOffScreen() && player2.isOffScreen()) { winner = 0; }
  }

  function drawRect(r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#15202b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const p of platforms) {
      drawRect(p, '#37474f');
      ctx.fillStyle = '#4b5b66';
      ctx.fillRect(p.x, p.y, p.w, 4);
    }

    for (const p of players) {
      const r = p.rect();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(r.x + 6, r.y + r.h + 4, r.w, 8);

      ctx.fillStyle = p.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = '#111';
      const eyeX = r.x + (p.facing === 1 ? r.w * 0.65 : r.w * 0.35);
      ctx.fillRect(eyeX - 6, r.y + 12, 8, 8);

      const hb = p.getAttackHitbox();
      if (hb) {
        ctx.fillStyle = 'rgba(255,255,0,0.35)';
        ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      }

      const damageX = (p === player1) ? 24 : WIDTH - 224;
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(`P${players.indexOf(p)+1} Damage: ${Math.floor(p.damage)}%`, damageX, 32);
    }

    if (winner !== null) {
      ctx.fillStyle = '#fff';
      ctx.font = '36px sans-serif';
      let t = 'Draw!';
      if (winner === 1) t = 'Player 1 Wins!';
      else if (winner === 2) t = 'Player 2 Wins!';
      ctx.fillText(t, WIDTH/2 - ctx.measureText(t).width/2, HEIGHT/2 - 6);
      ctx.font = '16px sans-serif';
      const s = 'Press R to restart';
      ctx.fillText(s, WIDTH/2 - ctx.measureText(s).width/2, HEIGHT/2 + 26);
    }

    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Score P1: ${player1.score}`, 24, HEIGHT - 16);
    ctx.fillText(`Score P2: ${player2.score}`, WIDTH - 120, HEIGHT - 16);
  }

  // Main loop
  let last = 0;
  function loop(ts) {
    const dt = ts - last;
    last = ts;

    if (matchActive && !winner) update();
    draw();

    requestAnimationFrame(loop);
  }

  // Start game flow
  function startMatch() {
    overlay.style.display = 'none';
    matchActive = true;
    restartRound();
    canvas.focus();
  }

  // Menu button handler
  if (btnStart) {
    btnStart.addEventListener('click', startMatch);
  }

  // Initialize
  restartRound();
  requestAnimationFrame(loop);
})();
