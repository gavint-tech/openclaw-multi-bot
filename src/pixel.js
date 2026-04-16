/**
 * pixel.js — pixel-art drawing helpers
 * ฟังก์ชันวาดตัวละครและห้องต่างๆ ด้วย Canvas API
 */

/**
 * วาดตัวละคร pixel art บน canvas
 * @param {HTMLCanvasElement} canvas
 * @param {{ hair, skin, shirt, pants }} colors
 */
function drawChar(canvas, colors) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var S = Math.floor(W / 14); // pixel size
  ctx.clearRect(0, 0, W, H);

  var h = colors.hair  || '#5d4037';
  var sk= colors.skin  || '#ffcc80';
  var sh= colors.shirt || '#1565c0';
  var pt= colors.pants || '#37474f';

  // row, col pixel map — 0=transparent, 1=hair, 2=skin, 3=shirt, 4=pants
  var map = [
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,1,0,0],
    [0,0,1,2,2,2,2,1,0,0],
    [0,0,0,1,2,2,1,0,0,0],
    [0,1,1,3,3,3,3,1,1,0],
    [0,1,3,3,3,3,3,3,1,0],
    [0,0,1,3,3,3,3,1,0,0],
    [0,0,1,4,4,4,4,1,0,0],
    [0,0,1,4,1,1,4,1,0,0],
    [0,0,1,4,0,0,4,1,0,0]
  ];
  var pal = ['transparent', h, sk, sh, pt];

  for (var r = 0; r < map.length; r++) {
    for (var c = 0; c < map[r].length; c++) {
      var v = map[r][c];
      if (v === 0) continue;
      ctx.fillStyle = pal[v];
      ctx.fillRect((c + 2) * S, r * S, S, S);
    }
  }
}

/**
 * วาดตัวละครขนาดเล็กสำหรับในห้อง
 */
function drawMiniChar(ctx, x, y, shirtColor, S) {
  ctx.fillStyle = '#ffcc80'; ctx.fillRect(x, y, S * 2, S * 2);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(x, y - S, S * 2, S);
  ctx.fillStyle = shirtColor; ctx.fillRect(x - S, y + S * 2, S * 4, S * 3);
  ctx.fillStyle = '#37474f';
  ctx.fillRect(x, y + S * 5, S, S * 2);
  ctx.fillRect(x + S, y + S * 5, S, S * 2);
}

/**
 * วาดห้องต่างๆ
 * @param {string} canvasId
 * @param {'conf'|'server'|'workspace'|'deploy'} scene
 */
function drawRoom(canvasId, scene) {
  var cv = document.getElementById(canvasId);
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height;
  var S = 4;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#060f1c'; ctx.fillRect(0, 0, W, H);

  if (scene === 'conf') {
    // Conference table
    ctx.fillStyle = '#1a3a5c'; ctx.fillRect(5*S, 3*S, 30*S, 10*S);
    // Chairs
    for (var i = 0; i < 8; i++) {
      ctx.fillStyle = '#0f2744';
      ctx.fillRect((6 + i * 3.5) * S, (i < 4 ? 1 : 13) * S, 2*S, 3*S);
    }
    // Monitor on table
    ctx.fillStyle = '#4fc3f7'; ctx.fillRect(14*S, 1*S, 12*S, 1*S);
    ctx.fillRect(14*S, 13*S, 12*S, 1*S);
    ctx.fillStyle = '#29b6f6'; ctx.fillRect(16*S, 0, 2*S, S);
    ctx.fillStyle = '#00ff88'; ctx.fillRect(22*S, 0, 2*S, S);
    drawMiniChar(ctx, 10*S, 4*S, '#0d47a1', S);
    drawMiniChar(ctx, 24*S, 4*S, '#4a148c', S);
    ctx.fillStyle = '#2e6b9e'; ctx.font = (S*2)+'px monospace';
    ctx.fillText('MEETING', 10*S, H - S);

  } else if (scene === 'server') {
    // Server racks
    for (var s = 0; s < 4; s++) {
      ctx.fillStyle = '#0f2744'; ctx.fillRect((3+s*9)*S, 2*S, 7*S, 15*S);
      ctx.fillStyle = '#1e3a5f'; ctx.fillRect((4+s*9)*S, 3*S, 5*S, 13*S);
      for (var r = 0; r < 5; r++) {
        ctx.fillStyle = r % 2 === 0 ? '#00ff88' : '#4fc3f7';
        ctx.fillRect((5+s*9)*S, (4+r*2)*S, 3*S, S);
      }
    }
    drawMiniChar(ctx, 34*S, 3*S, '#1b5e20', S);
    ctx.fillStyle = '#2e6b9e'; ctx.font = (S*2)+'px monospace';
    ctx.fillText('DOCKER', 4*S, H - S);

  } else if (scene === 'workspace') {
    // Desks with monitors
    for (var d = 0; d < 3; d++) {
      ctx.fillStyle = '#1a3a5c'; ctx.fillRect((2+d*12)*S, 4*S, 10*S, 6*S);
      ctx.fillStyle = '#29b6f6'; ctx.fillRect((3+d*12)*S, 5*S, 5*S, 4*S);
      ctx.fillStyle = '#0a1628'; ctx.fillRect((4+d*12)*S, 6*S, 3*S, 2*S);
      ctx.fillStyle = '#1e3a5f'; ctx.fillRect((2+d*12)*S, 10*S, 10*S, S);
      if (d < 2) drawMiniChar(ctx, (4+d*12)*S, S, '#1565c0', S);
    }
    ctx.fillStyle = '#2e6b9e'; ctx.font = (S*2)+'px monospace';
    ctx.fillText('WORKSPACE', 4*S, H - S);

  } else if (scene === 'deploy') {
    // Terminal panel
    ctx.fillStyle = '#0f2744'; ctx.fillRect(2*S, 2*S, 9*S, 14*S);
    ctx.fillStyle = '#1e3a5f'; ctx.fillRect(3*S, 3*S, 7*S, 12*S);
    ctx.fillStyle = '#4fc3f7'; ctx.fillRect(4*S, 4*S, 2*S, S);
    ctx.fillStyle = '#00ff88'; ctx.fillRect(4*S, 6*S, 2*S, S);
    ctx.fillStyle = '#ff6b6b'; ctx.fillRect(4*S, 8*S, 2*S, S);
    // Progress bars
    ctx.fillStyle = '#1a3a5c'; ctx.fillRect(14*S, 6*S, 22*S, 10*S);
    for (var li = 0; li < 5; li++) {
      ctx.fillStyle = '#1e3a5f'; ctx.fillRect(15*S, (7+li)*S, 20*S, S);
    }
    ctx.fillStyle = '#00ff88'; ctx.fillRect(15*S, 7*S, 12*S, S);
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(15*S, 9*S, 7*S, S);
    ctx.fillStyle = '#4fc3f7'; ctx.fillRect(15*S, 11*S, 18*S, S);
    drawMiniChar(ctx, 26*S, 2*S, '#4a148c', S);
    ctx.fillStyle = '#2e6b9e'; ctx.font = (S*2)+'px monospace';
    ctx.fillText('DEPLOY', 2*S, H - S);
  }
}

/** วาดทุกห้องตอน init */
function drawAllRooms() {
  drawRoom('canvas-conf',      'conf');
  drawRoom('canvas-server',    'server');
  drawRoom('canvas-workspace', 'workspace');
  drawRoom('canvas-deploy',    'deploy');
}
