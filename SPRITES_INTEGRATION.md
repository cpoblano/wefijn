How to integrate the sprite loader into the game quickly

This repo now has src/sprite-loader.js which exposes:
- Sprites.load(name) -> Promise resolving { img, desc }
- drawSprite(ctx, player) -> draws frame and returns true if drawn
- updateSpriteAnimation(player) -> advances internal timers

Quick integration steps:
1) Include or import the loader before the game code. If you're using the inlined index.html script, add a <script src="src/sprite-loader.js" type="module"></script> tag before the game script and reference the global Sprites/drawSprite functions.

2) When constructing players, pass a spriteName option and then call Sprites.load(spriteName) and set player.sprite to the resolved object.

3) In the player's update() function, after physics and state decisions, set player.currentAnim to 'idle'/'walk'/'jump'/'attack' as appropriate and call updateSpriteAnimation(player).

4) In the draw loop, use drawSprite(ctx, player) and if it returns false draw the original rectangle.

If you'd like I can perform these exact edits to src/game.js and index.html in this branch so they are fully wired; say "Yes, apply the integration edits" and I'll update both files and open a PR.
