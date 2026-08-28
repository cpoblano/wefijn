// Simple 2D Platform Fighter - src/game.js
// Drop this file at src/game.js and open index.html in a browser (or run a local static server).

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GRAVITY = 0.9;
  const FRICTION = 0.85;
  const GROUND_Y = HEIGHT - 40;

  // Platforms: x, y, w, h
  const platforms = [
    { x: 0, y: GROUND_Y, w: WIDTH, h: 40 },
    { x: 240, y: 360, w: 200, h: 18 },
    { x: 580, y: 300, w: 180, h: 18 }
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  class Player {
    constructor(x, color, controls, opts = {}) {
      this.x = x;
      this.y = 0;
      this.w = 44;
      this.h = 60;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.facing = 1; // 1 -> right, -1 -> left
      this.color = color;

      this.maxHealth = 100;
      this.health = this.maxHealth;

      this.attackCooldown = 0;
      this.attackDuration = 0;
      this.stun = 0;

      this.controls = controls;
      this.input = { left: false, right: false, up: false, attack: false };

      this.score = 0;

      // sprite-related (optional)
      this.spriteName = opts.spriteName || null; // name matches assets/characters/<name>.png + .json
      this.sprite = null; // will be set after preload
      this.currentAnim = 'idle';
      this.animFrame = 0;
      this.frameDuration = opts.frameDuration || 6;
      this._animTimer = null;
      this._animPlayOnce = false;
    }

    rect() {
      return { x: this.x - this.w/2, y: this.y - this.h, w: this.w, h: this.h };
    }

    update() {
      if (this.stun > 0) this.stun--;
      // Horizontal movement
      if (!this.stun) {
        if (this.input.left) { this.vx = clamp(this.vx - 1.2, -8, 8); this.facing = -1; }
        else if (this.input.right) { this.vx = clamp(this.vx + 1.2, -8, 8); this.facing = 1; }
        else this.vx *= FRICTION;
      } else {
        this.vx *= 0.95;
      }

      // Jump
      if (this.input.up && this.onGround && !this.stun) {
        this.vy = -18;
        this.onGround = false;
      }

      // Gravity
      this.vy += GRAVITY;
      // Limit vertical velocity
      this.vy = clamp(this.vy, -30, 30);

      // Position
      this.x += this.vx;
      this.y += this.vy;

      // World bounds
      this.x = clamp(this.x, this.w/2, WIDTH - this.w/2);
      if (this.y > HEIGHT + 200) { // fell off — respawn
        this.health = 0;
      }

      // Platform collisions
      this.onGround = false;
      const r = this.rect();
      for (const p of platforms) {
        if (r.x < p.x + p.w && r.x + r.w > p.x &&
            r.y < p.y + p.h && r.y + r.h > p.y) {
          // Simple resolution: only correct downward penetration
          if (this.vy >= 0 && (r.y + r.h) - this.vy <= p.y + p.h) {
            this.y = p.y;
            this.vy = 0;
            this.onGround = true;
          } else {
            // prevent overlapping sideways
            if (r.x < p.x) this.x = p.x - this.w/2;
            else this.x = p.x + p.w + this.w/2;
            this.vx = 0;
          }
        }
      }

      if (this.attackCooldown > 0) this.attackCooldown--;
      if (this.attackDuration > 0) this.attackDuration--;

      // Animation state selection
      if (this.attackDuration > 0) {
        this.setAnimation('attack', { playOnce: true });
      } else if (!this.onGround) {
        this.setAnimation('jump');
      } else if (Math.abs(this.vx) > 1) {
        this.setAnimation('walk');
      } else {
        this.setAnimation('idle');
      }

      // Advance sprite animation timing if available
      if (typeof updateSpriteAnimation === 'function') updateSpriteAnimation(this);
    }

    startAttack() {
      if (this.attackCooldown === 0 && this.attackDuration === 0 && !this.stun) {
        this.attackDuration = 12; // frames
        this.attackCooldown = 36; // frames before next
        // mark that we want the attack animation to play once
        this._animPlayOnce = true;
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

    setAnimation(name, { playOnce = false } = {}) {
      if (this.currentAnim === name) return;
      this.currentAnim = name;
      this.animFrame = 0;
      this._animTimer = null; // will be initialized by updateSpriteAnimation
      if (playOnce) this._animPlayOnce = true;
    }
  }

  // Controls mapping
  const player1 = new Player(200, '#63c2ff', {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', attack: 'KeyS'
  }, { spriteName: 'default' });
  const player2 = new Player(760, '#ff8b8b', {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', attack: 'ArrowDown'
  }, { spriteName: 'default' });

  let players = [player1, player2];

  // Input handling
  const keyMap = {};
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') restartRound();
    keyMap[e.code] = true;
    updateInputsFromKeys();
  });
  window.addEventListener('keyup', (e) => {
    keyMap[e.code] = false;
    updateInputsFromKeys();
  });

  function updateInputsFromKeys() {
    for (const p of players) {
      p.input.left = !!keyMap[p.controls.left];
      p.input.right = !!keyMap[p.controls.right];
      p.input.up = !!keyMap[p.controls.up];
      // attack pulses on keydown; handle separately only on keydown events
      // We'll handle attack trigger in the keydown listener above:
    }
  }

  // Attack keydown detection
  window.addEventListener('keydown', (e) => {
    if (e.code === player1.controls.attack) player1.startAttack();
    if (e.code === player2.controls.attack) player2.startAttack();
  });

  // Game state
  let winner = null;
  let freeze = 0;

  function restartRound() {
    player1.x = 200; player1.y = 0; player1.vx = 0; player1.vy = 0; player1.health = player1.maxHealth; player1.stun = 0; player1.jumpsLeft = 2; player1.attackHasHit = false; player1.invuln = 0;
    player2.x = 760; player2.y = 0; player2.vx = 0; player2.vy = 0; player2.health = player2.maxHealth; player2.stun = 0; player2.jumpsLeft = 2; player2.attackHasHit = false; player2.invuln = 0; 
    winner = null;
    freeze = 0;
  }

  function applyAttack(attacker, defender, hitbox) {
    if (!hitbox) return;
    const d = defender.rect();
    if (hitbox.x < d.x + d.w && hitbox.x + hitbox.w > d.x &&
        hitbox.y < d.y + d.h && hitbox.y + hitbox.h > d.y) {
      // hit!
      const damage = 10;
      defender.health = Math.max(0, defender.health - damage);
      const knock = 8 + (100 - defender.health) / 12; // more knock with more damage
      defender.vx = attacker.facing * knock;
      defender.vy = -6;
      defender.stun = 16;
      freeze = 6; // brief pause
    }
  }

  function update() {
    if (freeze > 0) { freeze--; return; }

    for (const p of players) p.update();

    // Attacks & collisions
    const hb1 = player1.getAttackHitbox();
    const hb2 = player2.getAttackHitbox();
    applyAttack(player1, player2, hb1);
    applyAttack(player2, player1, hb2);

    // Win check
    if (player1.health <= 0 && player2.health > 0) { winner = 2; player2.score++; }
    else if (player2.health <= 0 && player1.health > 0) { winner = 1; player1.score++; }
    else if (player1.health <= 0 && player2.health <= 0) { winner = 0; } // draw
  }

  // UI / Draw helpers
  function drawRect(r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  function draw() {
    // Clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // BG
    ctx.fillStyle = '#15202b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Platforms
    for (const p of platforms) {
      drawRect(p, '#37474f');
      // platform top highlight
      ctx.fillStyle = '#4b5b66';
      ctx.fillRect(p.x, p.y, p.w, 4);
    }

    // Players
    for (const p of players) {
      const r = p.rect();
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(r.x + 6, r.y + r.h + 4, r.w, 8);

      // Try drawing sprite if available
      let drawn = false;
      if (typeof drawSprite === 'function' && p.sprite) {
        try { drawn = drawSprite(ctx, p); } catch (e) { drawn = false; }
      }

      if (!drawn) {
        // body fallback
        ctx.fillStyle = p.color;
        ctx.fillRect(r.x, r.y, r.w, r.h);

        // face (simple)
        ctx.fillStyle = '#111';
        const eyeX = r.x + (p.facing === 1 ? r.w * 0.65 : r.w * 0.35);
        ctx.fillRect(eyeX - 6, r.y + 12, 8, 8);
      }

      // attack hitbox
      const hb = p.getAttackHitbox();
      if (hb) {
        ctx.fillStyle = 'rgba(255,255,0,0.35)';
        ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      }

      // health bar
      const barX = (p === player1) ? 24 : WIDTH - 224;
      ctx.fillStyle = '#000';
      ctx.fillRect(barX, 16, 200, 16);
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(barX + 2, 18, (196 * p.health / p.maxHealth), 12);
      ctx.strokeStyle = '#222';
      ctx.strokeRect(barX, 16, 200, 16);

      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.fillText(`P${players.indexOf(p)+1} HP: ${p.health}`, barX + 4, 14 + 6);
    }

    // center text
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

    // scores
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

    if (!winner) update();
    draw();

    requestAnimationFrame(loop);
  }

  // Start: dynamically import sprite-loader, preload character sheets, then start game
  async function start() {
    try {
      const mod = await import('./sprite-loader.js');
      // Preload sprites for players that requested one
      const loads = [];
      for (const p of players) {
        if (p.spriteName) loads.push(mod.Sprites.load(p.spriteName).then(s => { p.sprite = s; }));
      }
      await Promise.all(loads);
    } catch (e) {
      console.warn('Sprite loader or assets failed to load, continuing without sprites', e);
    }

    restartRound();
    requestAnimationFrame(loop);
  }

  start();

})();
