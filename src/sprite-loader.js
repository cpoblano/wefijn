/*
  sprite-loader.js
  Lightweight sprite manager + draw helper for the game.

  Usage:
    - Place sprite sheet PNG and JSON descriptor in assets/characters/<name>.png/.json
    - Include this script in your HTML or import it into src/game.js
    - Use Sprites.load(name) to preload; use drawSprite(ctx, player, sprite) in your draw loop.

  The JSON descriptor format (sample: assets/characters/default.json) is a simple object:
    {
      "frameDuration": 6,
      "animations": {
        "idle": { "frameDuration": 8, "frames": [ {"x":0,"y":0,"w":44,"h":60} ] },
        "walk": { "frameDuration": 5, "frames": [ ... ] },
        "jump": { "frameDuration": 10, "frames": [...] },
        "attack": { "frameDuration": 4, "frames": [...] }
      }
    }
*/

const Sprites = {
  cache: {},

  // Loads a sprite by name from assets/characters/<name>.png and <name>.json
  // Returns a promise that resolves to { img, desc }
  load(name, basePath = 'assets/characters/') {
    if (this.cache[name]) return Promise.resolve(this.cache[name]);

    const img = new Image();
    img.src = `${basePath}${name}.png`;

    const jsonUrl = `${basePath}${name}.json`;

    return fetch(jsonUrl).then(resp => {
      if (!resp.ok) throw new Error('Failed to fetch sprite json: ' + jsonUrl);
      return resp.json();
    }).then(desc => {
      return new Promise((resolve, reject) => {
        img.onload = () => {
          const s = { img, desc };
          this.cache[name] = s;
          resolve(s);
        };
        img.onerror = (e) => reject(new Error('Failed to load sprite image: ' + img.src));
      });
    });
  },

  get(name) { return this.cache[name] || null; }
};

// Draw helper: draws current animation frame for a player object.
// Assumptions about `player` object:
//  - player.rect() returns { x,y,w,h }
//  - player.sprite is the object returned by Sprites.load (or null)
//  - player.currentAnim, player.animFrame exist
//  - player.facing is 1 (right) or -1 (left)
// frame rects in JSON are pixel coordinates within the sheet

function drawSprite(ctx, player) {
  const r = player.rect();
  if (!player.sprite || !player.sprite.desc || !player.sprite.desc.animations) return false;
  const s = player.sprite;
  const anim = s.desc.animations[player.currentAnim];
  if (!anim) return false;
  const frame = anim.frames[player.animFrame] || anim.frames[0];
  if (!frame) return false;

  const fx = frame.x, fy = frame.y, fw = frame.w, fh = frame.h;

  ctx.save();
  if (player.facing === -1) {
    // flip horizontally around the player's center
    ctx.translate(r.x + r.w/2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(r.x + r.w/2), 0);
  }

  // Allow optional offsets per frame
  const offsetX = frame.offsetX || 0;
  const offsetY = frame.offsetY || 0;

  // Draw the sprite frame into the player's rect area (scaled to fit)
  ctx.drawImage(s.img, fx, fy, fw, fh, r.x + offsetX, r.y + offsetY, r.w, r.h);
  ctx.restore();
  return true;
}

// Helper to advance an animation frame given a player object and sprite desc
function updateSpriteAnimation(player) {
  if (!player.sprite || !player.sprite.desc || !player.sprite.desc.animations) return;
  const anim = player.sprite.desc.animations[player.currentAnim];
  if (!anim) return;
  if (player._animTimer == null) player._animTimer = (anim.frameDuration || player.frameDuration || 6);
  player._animTimer--;
  if (player._animTimer <= 0) {
    player.animFrame = (player.animFrame || 0) + 1;
    if (player.animFrame >= anim.frames.length) {
      if (player._animPlayOnce) {
        player.animFrame = anim.frames.length - 1;
        player._animPlayOnce = false;
      } else {
        player.animFrame = 0;
      }
    }
    player._animTimer = anim.frameDuration || player.frameDuration || 6;
  }
}

// Export for direct inclusion in browser global scope
if (typeof window !== 'undefined') {
  window.Sprites = Sprites;
  window.drawSprite = drawSprite;
  window.updateSpriteAnimation = updateSpriteAnimation;
}

export { Sprites, drawSprite, updateSpriteAnimation };