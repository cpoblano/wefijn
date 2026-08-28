Where to put sprites and how to name them

- Directory: project-root/assets/characters/
- Files: provide a PNG sprite sheet and a JSON descriptor with the same base name.
  - Example: assets/characters/default.png and assets/characters/default.json

JSON format (quick summary):
- top-level: {
    "frameDuration": <default frames per animation frame>,
    "animations": { <name>: { "frameDuration": <override>, "frames": [ {x,y,w,h, offsetX?, offsetY?}, ... ] } }
  }
- Each frame rectangle (x,y,w,h) refers to pixels inside the PNG.
- Optional offsetX/offsetY allow you to shift the drawn frame relative to the player's rectangle if your art isn't tightly cropped.

Sizing and placement
- The game's Player rectangle defaults to width=44 and height=60. If you make frames that exact size, they will map 1:1.
- The code will scale frames to the player's rect if frames are different sizes.

How to wire a sprite to a player (examples)

1) Simple integration (in src/game.js):

  // When creating a player, pass spriteName in opts
  const p = new Player(200, '#63c2ff', controls, { spriteName: 'default' });

  // Preload both players' sprites before starting the match loop
  Promise.all([Sprites.load('default'), Sprites.load('default')]).then(()=>{
    restartRound(); requestAnimationFrame(loop);
  }).catch(()=>{ restartRound(); requestAnimationFrame(loop); });

2) Player properties the loader expects (if you want to re-use the game's Player class):
- p.spriteName: string name, e.g. 'default'
- p.sprite: set to the result of Sprites.load(p.spriteName)
- p.currentAnim: name of animation, e.g. 'idle', 'walk', 'jump', 'attack'
- p.animFrame: current frame index (integer)
- p._animTimer: internal countdown until next frame
- p._animPlayOnce: optional boolean for one-shot animations (like attack)

3) In the draw loop, try drawing the sprite and fall back to rectangles if missing:

  if (!drawSprite(ctx, p)) {
    // fallback rectangle drawing (existing code)
  }

Notes
- Do NOT open index.html over file:// — use a local server (python -m http.server 8000).
- If you want me to apply these changes directly into src/game.js (so the Player class is fully integrated), I can update that file in this branch and create a PR. Let me know and I'll patch it next.
