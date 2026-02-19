(function () {
  'use strict';

  var SIZE = 4;
  var ANIM_DURATION = 150;

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

  var grid = [];
  var score = 0;
  var best = 0;
  var prevGrid = null;
  var prevScore = null;
  var gameOver = false;
  var moved = false;
  var tileElements = [];
  var animating = false;

  // ========================
  //   Helpers
  // ========================

  function cellPos(row, col) {
    var gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
    var cellSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
    return {
      left: gap + col * (cellSize + gap),
      top: gap + row * (cellSize + gap)
    };
  }

  function deepCopy(arr) {
    return arr.map(function (row) { return row.slice(); });
  }

  function isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // ========================
  //   Board Init
  // ========================

  function createBoard() {
    boardEl.textContent = '';
    tileElements = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        var pos = cellPos(r, c);
        cell.style.left = pos.left + 'px';
        cell.style.top = pos.top + 'px';
        boardEl.appendChild(cell);
      }
    }
  }

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) {
      g[r] = [];
      for (var c = 0; c < SIZE; c++) {
        g[r][c] = 0;
      }
    }
    return g;
  }

  function emptyCells() {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) cells.push({ r: r, c: c });
      }
    }
    return cells;
  }

  function addRandomTile(count) {
    var empty = emptyCells();
    var n = Math.min(count || 1, empty.length);
    for (var i = 0; i < n; i++) {
      var idx = Math.floor(Math.random() * empty.length);
      var cell = empty[idx];
      grid[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
      empty.splice(idx, 1);
    }
  }

  // ========================
  //   Rendering
  // ========================

  function clearTiles() {
    tileElements.forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    tileElements = [];
  }

  function createTileEl(value, row, col, isNew) {
    var el = document.createElement('div');
    var cls = value <= 2048 ? 'tile-' + value : 'tile-big';
    el.className = 'tile ' + cls;
    if (isNew) el.classList.add('tile-new');
    var pos = cellPos(row, col);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.textContent = value;
    boardEl.appendChild(el);
    tileElements.push(el);
    return el;
  }

  function renderGrid(newTiles, mergedTiles) {
    clearTiles();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] !== 0) {
          var isNew = newTiles && newTiles.some(function (t) { return t.r === r && t.c === c; });
          var isMerged = mergedTiles && mergedTiles.some(function (t) { return t.r === r && t.c === c; });
          var el = createTileEl(grid[r][c], r, c, isNew);
          if (isMerged) el.classList.add('tile-merged');
        }
      }
    }
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      saveBest();
    }
  }

  // ========================
  //   Movement Logic
  // ========================

  function slideRow(row) {
    var filtered = row.filter(function (v) { return v !== 0; });
    var result = [];
    var mergeScore = 0;
    var mergedIndices = [];

    for (var i = 0; i < filtered.length; i++) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        var merged = filtered[i] * 2;
        result.push(merged);
        mergeScore += merged;
        mergedIndices.push(result.length - 1);
        i++;
      } else {
        result.push(filtered[i]);
      }
    }

    while (result.length < SIZE) result.push(0);

    return { row: result, score: mergeScore, mergedIndices: mergedIndices };
  }

  function getColumn(g, c) {
    var col = [];
    for (var r = 0; r < SIZE; r++) col.push(g[r][c]);
    return col;
  }

  function setColumn(g, c, col) {
    for (var r = 0; r < SIZE; r++) g[r][c] = col[r];
  }

  function move(direction) {
    if (animating || gameOver) return false;

    prevGrid = deepCopy(grid);
    prevScore = score;

    var totalMergeScore = 0;
    var merged = [];
    var didMove = false;

    if (direction === 'left') {
      for (var r = 0; r < SIZE; r++) {
        var result = slideRow(grid[r]);
        if (grid[r].join(',') !== result.row.join(',')) didMove = true;
        grid[r] = result.row;
        totalMergeScore += result.score;
        result.mergedIndices.forEach(function (c) { merged.push({ r: r, c: c }); });
      }
    } else if (direction === 'right') {
      for (var r = 0; r < SIZE; r++) {
        var reversed = grid[r].slice().reverse();
        var result = slideRow(reversed);
        var row = result.row.reverse();
        if (grid[r].join(',') !== row.join(',')) didMove = true;
        grid[r] = row;
        totalMergeScore += result.score;
        result.mergedIndices.forEach(function (c) {
          merged.push({ r: r, c: SIZE - 1 - c });
        });
      }
    } else if (direction === 'up') {
      for (var c = 0; c < SIZE; c++) {
        var col = getColumn(grid, c);
        var result = slideRow(col);
        if (col.join(',') !== result.row.join(',')) didMove = true;
        setColumn(grid, c, result.row);
        totalMergeScore += result.score;
        result.mergedIndices.forEach(function (r) { merged.push({ r: r, c: c }); });
      }
    } else if (direction === 'down') {
      for (var c = 0; c < SIZE; c++) {
        var col = getColumn(grid, c).reverse();
        var result = slideRow(col);
        var newCol = result.row.reverse();
        var origCol = getColumn(grid, c);
        if (origCol.join(',') !== newCol.join(',')) didMove = true;
        setColumn(grid, c, newCol);
        totalMergeScore += result.score;
        result.mergedIndices.forEach(function (r) {
          merged.push({ r: SIZE - 1 - r, c: c });
        });
      }
    }

    if (!didMove) {
      prevGrid = null;
      prevScore = null;
      return false;
    }

    score += totalMergeScore;

    animateMove(direction, prevGrid, grid, merged, totalMergeScore);

    return true;
  }

  // ========================
  //   Animation
  // ========================

  function animateMove(direction, oldGrid, newGrid, mergedTiles, mergeScore) {
    animating = true;
    clearTiles();

    var movingTiles = [];
    var oldPositions = [];

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (oldGrid[r][c] !== 0) {
          oldPositions.push({ r: r, c: c, value: oldGrid[r][c] });
        }
      }
    }

    oldPositions.forEach(function (pos) {
      var el = document.createElement('div');
      var cls = pos.value <= 2048 ? 'tile-' + pos.value : 'tile-big';
      el.className = 'tile ' + cls;
      var cellP = cellPos(pos.r, pos.c);
      el.style.left = cellP.left + 'px';
      el.style.top = cellP.top + 'px';
      el.textContent = pos.value;
      boardEl.appendChild(el);
      movingTiles.push(el);
    });

    void boardEl.offsetWidth;

    var targets = computeTargets(oldGrid, direction);
    targets.forEach(function (t, i) {
      var el = movingTiles[i];
      var dest = cellPos(t.r, t.c);
      el.style.left = dest.left + 'px';
      el.style.top = dest.top + 'px';
    });

    if (mergeScore > 0) {
      showScorePop('+' + mergeScore);
    }

    setTimeout(function () {
      movingTiles.forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });

      var empty = emptyCells();
      var newTileCount = empty.length > 0 ? (Math.random() < 0.9 ? 1 : 2) : 0;
      newTileCount = Math.min(newTileCount, empty.length);
      var newTiles = [];
      for (var i = 0; i < newTileCount; i++) {
        var idx = Math.floor(Math.random() * empty.length);
        var cell = empty[idx];
        grid[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
        newTiles.push(cell);
        empty.splice(idx, 1);
      }

      renderGrid(newTiles, mergedTiles);
      updateScore();
      saveGame();

      if (checkGameOver()) {
        gameOver = true;
        showGameOver();
      }

      animating = false;
    }, ANIM_DURATION + 20);
  }

  function computeTargets(oldGrid, direction) {
    var positions = [];
    var targetGrid = emptyGrid();
    var occupied = emptyGrid();

    if (direction === 'left') {
      for (var r = 0; r < SIZE; r++) {
        var filtered = [];
        for (var c = 0; c < SIZE; c++) {
          if (oldGrid[r][c] !== 0) filtered.push({ value: oldGrid[r][c], origC: c });
        }
        var tc = 0;
        for (var i = 0; i < filtered.length; i++) {
          if (i + 1 < filtered.length && filtered[i].value === filtered[i + 1].value) {
            positions.push({ r: r, c: tc });
            i++;
            positions.push({ r: r, c: tc });
            tc++;
          } else {
            positions.push({ r: r, c: tc });
            tc++;
          }
        }
      }
    } else if (direction === 'right') {
      for (var r = 0; r < SIZE; r++) {
        var filtered = [];
        for (var c = SIZE - 1; c >= 0; c--) {
          if (oldGrid[r][c] !== 0) filtered.push({ value: oldGrid[r][c], origC: c });
        }
        var tc = SIZE - 1;
        var rowTargets = [];
        for (var i = 0; i < filtered.length; i++) {
          if (i + 1 < filtered.length && filtered[i].value === filtered[i + 1].value) {
            rowTargets.push({ r: r, c: tc });
            i++;
            rowTargets.push({ r: r, c: tc });
            tc--;
          } else {
            rowTargets.push({ r: r, c: tc });
            tc--;
          }
        }
        for (var j = rowTargets.length - 1; j >= 0; j--) {
          positions.push(rowTargets[j]);
        }
      }
    } else if (direction === 'up') {
      var colSorted = [];
      for (var c = 0; c < SIZE; c++) {
        var filtered = [];
        for (var r = 0; r < SIZE; r++) {
          if (oldGrid[r][c] !== 0) filtered.push({ value: oldGrid[r][c], origR: r });
        }
        var tr = 0;
        for (var i = 0; i < filtered.length; i++) {
          if (i + 1 < filtered.length && filtered[i].value === filtered[i + 1].value) {
            colSorted.push({ pos: { r: tr, c: c }, origR: filtered[i].origR, origC: c });
            i++;
            colSorted.push({ pos: { r: tr, c: c }, origR: filtered[i].origR, origC: c });
            tr++;
          } else {
            colSorted.push({ pos: { r: tr, c: c }, origR: filtered[i].origR, origC: c });
            tr++;
          }
        }
      }
      var posMap = [];
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (oldGrid[r][c] !== 0) {
            var found = null;
            for (var k = 0; k < colSorted.length; k++) {
              if (colSorted[k].origR === r && colSorted[k].origC === c) {
                found = colSorted[k].pos;
                colSorted.splice(k, 1);
                break;
              }
            }
            positions.push(found || { r: r, c: c });
          }
        }
      }
      return positions;
    } else if (direction === 'down') {
      var colSorted = [];
      for (var c = 0; c < SIZE; c++) {
        var filtered = [];
        for (var r = SIZE - 1; r >= 0; r--) {
          if (oldGrid[r][c] !== 0) filtered.push({ value: oldGrid[r][c], origR: r });
        }
        var tr = SIZE - 1;
        for (var i = 0; i < filtered.length; i++) {
          if (i + 1 < filtered.length && filtered[i].value === filtered[i + 1].value) {
            colSorted.push({ pos: { r: tr, c: c }, origR: filtered[i].origR, origC: c });
            i++;
            colSorted.push({ pos: { r: tr, c: c }, origR: filtered[i].origR, origC: c });
            tr--;
          } else {
            colSorted.push({ pos: { r: tr, c: c }, origR: filtered[i].origR, origC: c });
            tr--;
          }
        }
      }
      var posMap = [];
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (oldGrid[r][c] !== 0) {
            var found = null;
            for (var k = 0; k < colSorted.length; k++) {
              if (colSorted[k].origR === r && colSorted[k].origC === c) {
                found = colSorted[k].pos;
                colSorted.splice(k, 1);
                break;
              }
            }
            positions.push(found || { r: r, c: c });
          }
        }
      }
      return positions;
    }

    return positions;
  }

  function showScorePop(text) {
    var pop = document.createElement('div');
    pop.className = 'score-pop';
    pop.textContent = text;
    var scoreBox = document.querySelector('.score-box');
    var rect = scoreBox.getBoundingClientRect();
    pop.style.left = rect.left + rect.width / 2 - 20 + 'px';
    pop.style.top = rect.top - 10 + 'px';
    pop.style.position = 'fixed';
    document.body.appendChild(pop);
    setTimeout(function () {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 650);
  }

  // ========================
  //   Game Over Check
  // ========================

  function checkGameOver() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return false;
        if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false;
        if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false;
      }
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
    hideMobileControls();
  }

  // ========================
  //   Undo
  // ========================

  function undo() {
    if (animating || gameOver || !prevGrid) return;
    grid = deepCopy(prevGrid);
    score = prevScore;
    prevGrid = null;
    prevScore = null;
    renderGrid(null, null);
    updateScore();
    saveGame();
  }

  // ========================
  //   Leaderboard
  // ========================

  function loadLeaderboard() {
    try {
      var data = localStorage.getItem('2048_leaderboard');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLeaderboard(board) {
    localStorage.setItem('2048_leaderboard', JSON.stringify(board));
  }

  function addRecord(name, s) {
    var board = loadLeaderboard();
    board.push({
      name: name,
      score: s,
      date: new Date().toLocaleDateString('ru-RU')
    });
    board.sort(function (a, b) { return b.score - a.score; });
    if (board.length > 10) board.length = 10;
    saveLeaderboard(board);
  }

  function renderLeaderboard() {
    var board = loadLeaderboard();

    while (leaderboardBody.firstChild) {
      leaderboardBody.removeChild(leaderboardBody.firstChild);
    }

    if (board.length === 0) {
      noRecords.classList.remove('hidden');
      return;
    }

    noRecords.classList.add('hidden');

    board.forEach(function (entry, i) {
      var tr = document.createElement('tr');

      var tdNum = document.createElement('td');
      tdNum.textContent = i + 1;
      tr.appendChild(tdNum);

      var tdName = document.createElement('td');
      tdName.textContent = entry.name;
      tr.appendChild(tdName);

      var tdScore = document.createElement('td');
      tdScore.textContent = entry.score;
      tr.appendChild(tdScore);

      var tdDate = document.createElement('td');
      tdDate.textContent = entry.date;
      tr.appendChild(tdDate);

      leaderboardBody.appendChild(tr);
    });
  }

  // ========================
  //   Save / Load Game
  // ========================

  function saveGame() {
    var state = {
      grid: grid,
      score: score,
      gameOver: gameOver,
      prevGrid: prevGrid,
      prevScore: prevScore
    };
    localStorage.setItem('2048_state', JSON.stringify(state));
  }

  function loadGame() {
    try {
      var data = localStorage.getItem('2048_state');
      if (!data) return false;
      var state = JSON.parse(data);
      if (!state.grid || state.grid.length !== SIZE) return false;
      grid = state.grid;
      score = state.score || 0;
      gameOver = state.gameOver || false;
      prevGrid = state.prevGrid || null;
      prevScore = state.prevScore != null ? state.prevScore : null;
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveBest() {
    localStorage.setItem('2048_best', String(best));
  }

  function loadBest() {
    var val = localStorage.getItem('2048_best');
    return val ? parseInt(val, 10) : 0;
  }

  // ========================
  //   New Game
  // ========================

  function newGame() {
    gameOver = false;
    score = 0;
    prevGrid = null;
    prevScore = null;
    grid = emptyGrid();
    var startCount = 1 + Math.floor(Math.random() * 3);
    addRandomTile(startCount);
    overlayEl.classList.add('hidden');
    renderGrid(null, null);
    updateScore();
    saveGame();
    showMobileControls();
  }

  // ========================
  //   Mobile Controls
  // ========================

  function showMobileControls() {
    if (isMobile()) {
      mobileControls.classList.remove('hidden');
    }
  }

  function hideMobileControls() {
    mobileControls.classList.add('hidden');
  }

  // ========================
  //   Event Listeners
  // ========================

  document.addEventListener('keydown', function (e) {
    var dirMap = {
      ArrowUp: 'up', ArrowDown: 'down',
      ArrowLeft: 'left', ArrowRight: 'right'
    };
    if (dirMap[e.key]) {
      e.preventDefault();
      move(dirMap[e.key]);
    }
  });

  btnNew.addEventListener('click', function () { newGame(); });
  btnUndo.addEventListener('click', function () { undo(); });

  btnRetry.addEventListener('click', function () { newGame(); });

  btnSave.addEventListener('click', function () {
    var name = playerNameEl.value.trim();
    if (!name) {
      playerNameEl.focus();
      return;
    }
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
    if (e.target === leaderboardModal) {
      leaderboardModal.classList.add('hidden');
    }
  });

  document.getElementById('m-up').addEventListener('click', function () { move('up'); });
  document.getElementById('m-down').addEventListener('click', function () { move('down'); });
  document.getElementById('m-left').addEventListener('click', function () { move('left'); });
  document.getElementById('m-right').addEventListener('click', function () { move('right'); });

  // Swipe support
  (function () {
    var startX, startY;
    var threshold = 30;

    boardEl.addEventListener('touchstart', function (e) {
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    boardEl.addEventListener('touchend', function (e) {
      if (!startX || !startY) return;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < threshold) return;

      if (absDx > absDy) {
        move(dx > 0 ? 'right' : 'left');
      } else {
        move(dy > 0 ? 'down' : 'up');
      }

      startX = null;
      startY = null;
    }, { passive: true });
  })();

  // ========================
  //   Init
  // ========================

  best = loadBest();
  bestEl.textContent = best;
  createBoard();

  if (loadGame()) {
    renderGrid(null, null);
    updateScore();
    if (gameOver) {
      showGameOver();
    } else {
      showMobileControls();
    }
  } else {
    newGame();
  }

})();
