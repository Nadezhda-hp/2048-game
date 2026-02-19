(function () {
  'use strict';

  var SIZE = 4;
  var GAP = 10;
  var ANIM_MS = 150;

  var boardEl = document.getElementById('board');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var overlayEl = document.getElementById('overlay-gameover');
  var gameoverTitleEl = document.getElementById('gameover-title');
  var gameoverScoreEl = document.getElementById('gameover-score');
  var submitSection = document.getElementById('submit-section');
  var playerNameEl = document.getElementById('player-name');
  var btnSave = document.getElementById('btn-save');
  var btnRetry = document.getElementById('btn-retry');
  var btnNew = document.getElementById('btn-new');
  var btnUndo = document.getElementById('btn-undo');
  var btnLeaders = document.getElementById('btn-leaders');
  var leaderboardModal = document.getElementById('leaderboard-modal');
  var leaderboardBody = document.getElementById('leaderboard-body');
  var noRecords = document.getElementById('no-records');
  var btnCloseLeaders = document.getElementById('btn-close-leaders');
  var mobileControls = document.getElementById('mobile-controls');
  var wrapper = document.querySelector('.board-wrapper');

  var grid = [];
  var score = 0;
  var best = 0;
  var prevGrid = null;
  var prevScore = null;
  var gameOver = false;
  var tileEls = [];
  var animating = false;
  var boardPx = 420;
  var cellPx = 0;

  function calcSizes() {
    var maxW = Math.min(420, window.innerWidth - 40);
    boardPx = Math.floor(maxW);
    cellPx = Math.floor((boardPx - GAP * (SIZE + 1)) / SIZE);
    boardPx = cellPx * SIZE + GAP * (SIZE + 1);

    wrapper.style.width = boardPx + 'px';
    wrapper.style.height = boardPx + 'px';
    boardEl.style.width = boardPx + 'px';
    boardEl.style.height = boardPx + 'px';
  }

  function cellLeft(col) { return GAP + col * (cellPx + GAP); }
  function cellTop(row) { return GAP + row * (cellPx + GAP); }

  function deepCopy(a) { return a.map(function (r) { return r.slice(); }); }

  function isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function fontSize(value) {
    if (cellPx < 60) {
      if (value >= 1024) return '14px';
      if (value >= 128) return '18px';
      return '22px';
    }
    if (cellPx < 85) {
      if (value >= 1024) return '18px';
      if (value >= 128) return '24px';
      return '28px';
    }
    if (value >= 1024) return '24px';
    if (value >= 128) return '30px';
    return '36px';
  }

  // ---- Board ----

  function drawCells() {
    var old = boardEl.querySelectorAll('.cell');
    for (var i = 0; i < old.length; i++) boardEl.removeChild(old[i]);

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var d = document.createElement('div');
        d.className = 'cell';
        d.style.width = cellPx + 'px';
        d.style.height = cellPx + 'px';
        d.style.left = cellLeft(c) + 'px';
        d.style.top = cellTop(r) + 'px';
        boardEl.appendChild(d);
      }
    }
  }

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) {
      g[r] = [];
      for (var c = 0; c < SIZE; c++) g[r][c] = 0;
    }
    return g;
  }

  function emptyCells() {
    var out = [];
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (grid[r][c] === 0) out.push({ r: r, c: c });
    return out;
  }

  function addRandom(n) {
    var free = emptyCells();
    n = Math.min(n || 1, free.length);
    for (var i = 0; i < n; i++) {
      var idx = Math.floor(Math.random() * free.length);
      grid[free[idx].r][free[idx].c] = Math.random() < 0.9 ? 2 : 4;
      free.splice(idx, 1);
    }
  }

  // ---- Tiles ----

  function clearTiles() {
    for (var i = 0; i < tileEls.length; i++)
      if (tileEls[i].parentNode) tileEls[i].parentNode.removeChild(tileEls[i]);
    tileEls = [];
  }

  function makeTile(val, r, c, extra) {
    var el = document.createElement('div');
    el.className = 'tile ' + (val <= 2048 ? 'tile-' + val : 'tile-big');
    if (extra) el.classList.add(extra);
    el.style.width = cellPx + 'px';
    el.style.height = cellPx + 'px';
    el.style.left = cellLeft(c) + 'px';
    el.style.top = cellTop(r) + 'px';
    el.style.fontSize = fontSize(val);
    el.style.transition = 'left ' + ANIM_MS + 'ms ease, top ' + ANIM_MS + 'ms ease';
    el.textContent = val;
    boardEl.appendChild(el);
    tileEls.push(el);
    return el;
  }

  function renderAll(newCells, mergedCells) {
    clearTiles();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) continue;
        var isNew = newCells && newCells.some(function (t) { return t.r === r && t.c === c; });
        var isMerged = mergedCells && mergedCells.some(function (t) { return t.r === r && t.c === c; });
        makeTile(grid[r][c], r, c, isNew ? 'tile-new' : isMerged ? 'tile-merged' : null);
      }
    }
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem('2048_best', String(best));
    }
  }

  // ---- Slide Logic ----

  function slideRow(row) {
    var f = row.filter(function (v) { return v !== 0; });
    var out = [], pts = 0, mi = [];
    for (var i = 0; i < f.length; i++) {
      if (i + 1 < f.length && f[i] === f[i + 1]) {
        var v = f[i] * 2;
        out.push(v);
        pts += v;
        mi.push(out.length - 1);
        i++;
      } else {
        out.push(f[i]);
      }
    }
    while (out.length < SIZE) out.push(0);
    return { row: out, pts: pts, mi: mi };
  }

  function getCol(g, c) {
    var col = [];
    for (var r = 0; r < SIZE; r++) col.push(g[r][c]);
    return col;
  }
  function setCol(g, c, col) {
    for (var r = 0; r < SIZE; r++) g[r][c] = col[r];
  }

  function move(dir) {
    if (animating || gameOver) return false;

    var oldGrid = deepCopy(grid);
    var oldScore = score;
    var pts = 0, merged = [], changed = false;

    if (dir === 'left') {
      for (var r = 0; r < SIZE; r++) {
        var res = slideRow(grid[r]);
        if (grid[r].join() !== res.row.join()) changed = true;
        grid[r] = res.row;
        pts += res.pts;
        res.mi.forEach(function (c) { merged.push({ r: r, c: c }); });
      }
    } else if (dir === 'right') {
      for (var r = 0; r < SIZE; r++) {
        var res = slideRow(grid[r].slice().reverse());
        var row = res.row.reverse();
        if (grid[r].join() !== row.join()) changed = true;
        grid[r] = row;
        pts += res.pts;
        res.mi.forEach(function (c) { merged.push({ r: r, c: SIZE - 1 - c }); });
      }
    } else if (dir === 'up') {
      for (var c = 0; c < SIZE; c++) {
        var col = getCol(grid, c);
        var res = slideRow(col);
        if (col.join() !== res.row.join()) changed = true;
        setCol(grid, c, res.row);
        pts += res.pts;
        res.mi.forEach(function (r) { merged.push({ r: r, c: c }); });
      }
    } else if (dir === 'down') {
      for (var c = 0; c < SIZE; c++) {
        var col = getCol(grid, c).reverse();
        var res = slideRow(col);
        var nc = res.row.reverse();
        if (getCol(oldGrid, c).join() !== nc.join()) changed = true;
        setCol(grid, c, nc);
        pts += res.pts;
        res.mi.forEach(function (r) { merged.push({ r: SIZE - 1 - r, c: c }); });
      }
    }

    if (!changed) return false;

    prevGrid = oldGrid;
    prevScore = oldScore;
    score += pts;

    doAnimate(dir, oldGrid, merged, pts);
    return true;
  }

  // ---- Animation ----

  function doAnimate(dir, oldGrid, mergedCells, pts) {
    animating = true;
    clearTiles();

    var tiles = [];
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (oldGrid[r][c] !== 0)
          tiles.push({ r: r, c: c, val: oldGrid[r][c] });

    var targets = getTargets(oldGrid, dir);
    var els = [];

    tiles.forEach(function (t, i) {
      var el = makeTile(t.val, t.r, t.c, null);
      el.style.transition = 'none';
      els.push(el);
    });

    void boardEl.offsetWidth;

    els.forEach(function (el, i) {
      el.style.transition = 'left ' + ANIM_MS + 'ms ease, top ' + ANIM_MS + 'ms ease';
      el.style.left = cellLeft(targets[i].c) + 'px';
      el.style.top = cellTop(targets[i].r) + 'px';
    });

    if (pts > 0) showScorePop('+' + pts);

    setTimeout(function () {
      clearTiles();

      var free = emptyCells();
      var addCount = Math.min(Math.random() < 0.9 ? 1 : 2, free.length);
      var newCells = [];
      for (var i = 0; i < addCount; i++) {
        var idx = Math.floor(Math.random() * free.length);
        grid[free[idx].r][free[idx].c] = Math.random() < 0.9 ? 2 : 4;
        newCells.push(free[idx]);
        free.splice(idx, 1);
      }

      renderAll(newCells, mergedCells);
      updateScore();
      saveGame();

      if (isGameOver()) {
        gameOver = true;
        showGameOver();
      }
      animating = false;
    }, ANIM_MS + 30);
  }

  function getTargets(old, dir) {
    var out = [];
    var process = [];

    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (old[r][c] !== 0)
          process.push({ r: r, c: c, val: old[r][c] });

    if (dir === 'left') {
      for (var r = 0; r < SIZE; r++) {
        var items = process.filter(function (p) { return p.r === r; })
                           .sort(function (a, b) { return a.c - b.c; });
        var tc = 0;
        for (var i = 0; i < items.length; i++) {
          if (i + 1 < items.length && items[i].val === items[i + 1].val) {
            items[i].target = { r: r, c: tc };
            items[i + 1].target = { r: r, c: tc };
            tc++; i++;
          } else {
            items[i].target = { r: r, c: tc };
            tc++;
          }
        }
      }
    } else if (dir === 'right') {
      for (var r = 0; r < SIZE; r++) {
        var items = process.filter(function (p) { return p.r === r; })
                           .sort(function (a, b) { return b.c - a.c; });
        var tc = SIZE - 1;
        for (var i = 0; i < items.length; i++) {
          if (i + 1 < items.length && items[i].val === items[i + 1].val) {
            items[i].target = { r: r, c: tc };
            items[i + 1].target = { r: r, c: tc };
            tc--; i++;
          } else {
            items[i].target = { r: r, c: tc };
            tc--;
          }
        }
      }
    } else if (dir === 'up') {
      for (var c = 0; c < SIZE; c++) {
        var items = process.filter(function (p) { return p.c === c; })
                           .sort(function (a, b) { return a.r - b.r; });
        var tr = 0;
        for (var i = 0; i < items.length; i++) {
          if (i + 1 < items.length && items[i].val === items[i + 1].val) {
            items[i].target = { r: tr, c: c };
            items[i + 1].target = { r: tr, c: c };
            tr++; i++;
          } else {
            items[i].target = { r: tr, c: c };
            tr++;
          }
        }
      }
    } else if (dir === 'down') {
      for (var c = 0; c < SIZE; c++) {
        var items = process.filter(function (p) { return p.c === c; })
                           .sort(function (a, b) { return b.r - a.r; });
        var tr = SIZE - 1;
        for (var i = 0; i < items.length; i++) {
          if (i + 1 < items.length && items[i].val === items[i + 1].val) {
            items[i].target = { r: tr, c: c };
            items[i + 1].target = { r: tr, c: c };
            tr--; i++;
          } else {
            items[i].target = { r: tr, c: c };
            tr--;
          }
        }
      }
    }

    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        for (var k = 0; k < process.length; k++)
          if (process[k].r === r && process[k].c === c && !process[k].used) {
            out.push(process[k].target || { r: r, c: c });
            process[k].used = true;
            break;
          }

    return out;
  }

  function showScorePop(text) {
    var pop = document.createElement('div');
    pop.className = 'score-pop';
    pop.textContent = text;
    var box = document.querySelector('.score-box');
    var rect = box.getBoundingClientRect();
    pop.style.left = (rect.left + rect.width / 2 - 15) + 'px';
    pop.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(pop);
    setTimeout(function () {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 650);
  }

  // ---- Game Over ----

  function isGameOver() {
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return false;
        if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false;
        if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false;
      }
    return true;
  }

  function showGameOver() {
    gameoverScoreEl.textContent = score;
    gameoverTitleEl.textContent = 'Игра окончена!';
    submitSection.classList.remove('hidden');
    playerNameEl.value = '';
    playerNameEl.style.display = '';
    btnSave.style.display = '';
    overlayEl.classList.remove('hidden');
    mobileControls.classList.add('hidden');
  }

  // ---- Undo ----

  function undo() {
    if (animating || gameOver || !prevGrid) return;
    grid = deepCopy(prevGrid);
    score = prevScore;
    prevGrid = null;
    prevScore = null;
    renderAll(null, null);
    updateScore();
    saveGame();
  }

  // ---- Leaderboard ----

  function getLeaderboard() {
    try { return JSON.parse(localStorage.getItem('2048_leaderboard')) || []; }
    catch (e) { return []; }
  }

  function addRecord(name, s) {
    var b = getLeaderboard();
    b.push({ name: name, score: s, date: new Date().toLocaleDateString('ru-RU') });
    b.sort(function (a, b) { return b.score - a.score; });
    if (b.length > 10) b.length = 10;
    localStorage.setItem('2048_leaderboard', JSON.stringify(b));
  }

  function renderLeaderboard() {
    var b = getLeaderboard();
    while (leaderboardBody.firstChild) leaderboardBody.removeChild(leaderboardBody.firstChild);
    if (b.length === 0) { noRecords.classList.remove('hidden'); return; }
    noRecords.classList.add('hidden');
    b.forEach(function (e, i) {
      var tr = document.createElement('tr');
      [i + 1, e.name, e.score, e.date].forEach(function (txt) {
        var td = document.createElement('td');
        td.textContent = txt;
        tr.appendChild(td);
      });
      leaderboardBody.appendChild(tr);
    });
  }

  // ---- Save / Load ----

  function saveGame() {
    localStorage.setItem('2048_state', JSON.stringify({
      grid: grid, score: score, gameOver: gameOver,
      prevGrid: prevGrid, prevScore: prevScore
    }));
  }

  function loadGame() {
    try {
      var s = JSON.parse(localStorage.getItem('2048_state'));
      if (!s || !s.grid || s.grid.length !== SIZE) return false;
      grid = s.grid; score = s.score || 0;
      gameOver = s.gameOver || false;
      prevGrid = s.prevGrid || null;
      prevScore = s.prevScore != null ? s.prevScore : null;
      return true;
    } catch (e) { return false; }
  }

  // ---- New Game ----

  function newGame() {
    gameOver = false; score = 0;
    prevGrid = null; prevScore = null;
    grid = emptyGrid();
    addRandom(1 + Math.floor(Math.random() * 3));
    overlayEl.classList.add('hidden');
    renderAll(null, null);
    updateScore();
    saveGame();
    if (isMobile()) mobileControls.classList.remove('hidden');
  }

  // ---- Events ----

  document.addEventListener('keydown', function (e) {
    var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
  });

  btnNew.addEventListener('click', newGame);
  btnUndo.addEventListener('click', undo);
  btnRetry.addEventListener('click', newGame);

  btnSave.addEventListener('click', function () {
    var name = playerNameEl.value.trim();
    if (!name) { playerNameEl.focus(); return; }
    addRecord(name, score);
    gameoverTitleEl.textContent = 'Ваш рекорд сохранён!';
    playerNameEl.style.display = 'none';
    btnSave.style.display = 'none';
  });

  btnLeaders.addEventListener('click', function () {
    renderLeaderboard();
    leaderboardModal.classList.remove('hidden');
  });

  btnCloseLeaders.addEventListener('click', function () {
    leaderboardModal.classList.add('hidden');
  });

  leaderboardModal.addEventListener('click', function (e) {
    if (e.target === leaderboardModal) leaderboardModal.classList.add('hidden');
  });

  document.getElementById('m-up').addEventListener('click', function () { move('up'); });
  document.getElementById('m-down').addEventListener('click', function () { move('down'); });
  document.getElementById('m-left').addEventListener('click', function () { move('left'); });
  document.getElementById('m-right').addEventListener('click', function () { move('right'); });

  (function () {
    var sx, sy;
    boardEl.addEventListener('touchstart', function (e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    boardEl.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      sx = sy = null;
    }, { passive: true });
  })();

  window.addEventListener('resize', function () {
    calcSizes(); drawCells(); renderAll(null, null);
  });

  // ---- Init ----

  best = parseInt(localStorage.getItem('2048_best')) || 0;
  bestEl.textContent = best;
  calcSizes();
  drawCells();

  if (loadGame()) {
    renderAll(null, null);
    updateScore();
    if (gameOver) showGameOver();
    else if (isMobile()) mobileControls.classList.remove('hidden');
  } else {
    newGame();
  }

})();
