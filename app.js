/* =====================================================================
 * Sudoku - HTML/CSS/JS thuần
 * Cấu trúc:
 *   1. Engine   : sinh lưới, solver, kiểm tra nghiệm duy nhất
 *   2. State    : trạng thái ván chơi + lưu/khôi phục localStorage
 *   3. UI       : render bàn cờ, bàn phím số, modal, xử lý input
 * Phần Engine được export cho Node để chạy test (sudoku-test.js).
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * 1. ENGINE
 * ------------------------------------------------------------------- */
const Sudoku = (() => {
  const N = 9;
  const CELLS = 81;
  const ALL = 0x1ff; // 9 bit, bit (d-1) = số d khả dụng

  // Bảng tra cứu: chỉ số hàng, cột, vùng và danh sách ô cùng đơn vị (peers)
  const ROW = new Array(CELLS);
  const COL = new Array(CELLS);
  const BOX = new Array(CELLS);
  const PEERS = new Array(CELLS);
  for (let i = 0; i < CELLS; i++) {
    ROW[i] = Math.floor(i / N);
    COL[i] = i % N;
    BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
  }
  for (let i = 0; i < CELLS; i++) {
    const set = [];
    for (let j = 0; j < CELLS; j++) {
      if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) {
        set.push(j);
      }
    }
    PEERS[i] = set;
  }

  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function bitCount(x) {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }

  /**
   * Tính bitmask số đã dùng theo hàng/cột/vùng của lưới (0 = trống).
   * Trả về null nếu đề mâu thuẫn (có số trùng trong cùng một đơn vị).
   */
  function buildCandidates(grid) {
    const rows = new Array(N).fill(0);
    const cols = new Array(N).fill(0);
    const boxes = new Array(N).fill(0);
    for (let i = 0; i < CELLS; i++) {
      const v = grid[i];
      if (v) {
        const bit = 1 << (v - 1);
        if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & bit) return null;
        rows[ROW[i]] |= bit;
        cols[COL[i]] |= bit;
        boxes[BOX[i]] |= bit;
      }
    }
    return { rows, cols, boxes };
  }

  /**
   * Đếm số nghiệm của lưới, dừng khi đạt `limit`.
   * Dùng MRV (chọn ô ít ứng viên nhất) để cắt tỉa nhanh.
   */
  function countSolutions(grid, limit = 2) {
    const g = grid.slice();
    const units = buildCandidates(g);
    if (!units) return 0;
    const { rows, cols, boxes } = units;
    let count = 0;

    function search() {
      // Chọn ô trống có ít ứng viên nhất
      let best = -1;
      let bestMask = 0;
      let bestCount = 10;
      for (let i = 0; i < CELLS; i++) {
        if (g[i]) continue;
        const mask = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
        const c = bitCount(mask);
        if (c === 0) return; // ngõ cụt
        if (c < bestCount) {
          bestCount = c;
          bestMask = mask;
          best = i;
          if (c === 1) break;
        }
      }
      if (best === -1) {
        count++;
        return;
      }
      const r = ROW[best];
      const c = COL[best];
      const b = BOX[best];
      for (let d = 0; d < N; d++) {
        const bit = 1 << d;
        if (!(bestMask & bit)) continue;
        g[best] = d + 1;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        search();
        rows[r] &= ~bit;
        cols[c] &= ~bit;
        boxes[b] &= ~bit;
        g[best] = 0;
        if (count >= limit) return;
      }
    }

    search();
    return count;
  }

  /** Giải lưới, trả về mảng 81 phần tử hoặc null nếu vô nghiệm. */
  function solve(grid) {
    const g = grid.slice();
    const units = buildCandidates(g);
    if (!units) return null;
    const { rows, cols, boxes } = units;

    function search() {
      let best = -1;
      let bestMask = 0;
      let bestCount = 10;
      for (let i = 0; i < CELLS; i++) {
        if (g[i]) continue;
        const mask = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
        const c = bitCount(mask);
        if (c === 0) return false;
        if (c < bestCount) {
          bestCount = c;
          bestMask = mask;
          best = i;
          if (c === 1) break;
        }
      }
      if (best === -1) return true;
      const r = ROW[best];
      const c = COL[best];
      const b = BOX[best];
      for (let d = 0; d < N; d++) {
        const bit = 1 << d;
        if (!(bestMask & bit)) continue;
        g[best] = d + 1;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        if (search()) return true;
        rows[r] &= ~bit;
        cols[c] &= ~bit;
        boxes[b] &= ~bit;
        g[best] = 0;
      }
      return false;
    }

    return search() ? g : null;
  }

  /** Sinh lưới đầy hợp lệ bằng backtracking với thứ tự số ngẫu nhiên. */
  function generateFullGrid() {
    const g = new Array(CELLS).fill(0);
    const rows = new Array(N).fill(0);
    const cols = new Array(N).fill(0);
    const boxes = new Array(N).fill(0);

    function fill(i) {
      if (i === CELLS) return true;
      const r = ROW[i];
      const c = COL[i];
      const b = BOX[i];
      const used = rows[r] | cols[c] | boxes[b];
      const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const d of digits) {
        const bit = 1 << (d - 1);
        if (used & bit) continue;
        g[i] = d;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        if (fill(i + 1)) return true;
        rows[r] &= ~bit;
        cols[c] &= ~bit;
        boxes[b] &= ~bit;
        g[i] = 0;
      }
      return false;
    }

    fill(0);
    return g;
  }

  /**
   * Từ lưới đầy, xóa dần các ô theo thứ tự ngẫu nhiên; chỉ giữ lại thao tác
   * xóa nếu đề vẫn có đúng một nghiệm. Dừng khi số ô cho trước <= target.
   */
  function carve(solution, targetGivens) {
    const puzzle = solution.slice();
    let givens = CELLS;
    const order = shuffle([...Array(CELLS).keys()]);
    for (const idx of order) {
      if (givens <= targetGivens) break;
      const backup = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        givens--;
      } else {
        puzzle[idx] = backup;
      }
    }
    return { puzzle, givens };
  }

  /**
   * Sinh đề với số ô cho trước mục tiêu. Thử vài lần để tiến gần mục tiêu
   * nhất có thể (với đề rất khó, một lượt xóa có thể không đạt).
   */
  function generatePuzzle(targetGivens, maxAttempts = 6) {
    let best = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const solution = generateFullGrid();
      const { puzzle, givens } = carve(solution, targetGivens);
      if (!best || givens < best.givens) {
        best = { puzzle, solution, givens };
      }
      if (givens <= targetGivens) break;
    }
    return best;
  }

  return {
    CELLS,
    ROW,
    COL,
    BOX,
    PEERS,
    countSolutions,
    solve,
    generateFullGrid,
    generatePuzzle,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Sudoku;
}

/* ---------------------------------------------------------------------
 * 2 + 3. GAME (chỉ chạy trong trình duyệt)
 * ------------------------------------------------------------------- */
if (typeof document !== 'undefined') {
  (() => {
    const STORAGE_KEY = 'sudoku-vn-save-v1';
    const PROGRESS_KEY = 'sudoku-vn-progress-v1';
    const MAX_MISTAKES = 3;
    const MAX_HINTS = 1; // số lượt gợi ý mỗi ván

    // Thứ tự độ khó tăng dần. `unlockWins`: số ván phải thắng ở độ khó liền
    // trước để mở khóa độ khó này (độ khó đầu tiên luôn mở).
    const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert', 'extreme'];
    const DIFFICULTIES = {
      easy: { label: 'Dễ', givens: 40, level: 1, unlockWins: 0, desc: 'Làm quen, nhiều ô cho trước' },
      medium: { label: 'Trung bình', givens: 34, level: 2, unlockWins: 3, desc: 'Cần suy luận cơ bản' },
      hard: { label: 'Khó', givens: 29, level: 3, unlockWins: 3, desc: 'Nên dùng ghi chú' },
      expert: { label: 'Chuyên gia', givens: 25, level: 4, unlockWins: 3, desc: 'Ít ô cho trước, kỹ thuật nâng cao' },
      extreme: { label: 'Cực khó', givens: 22, level: 5, unlockWins: 3, desc: 'Thử thách tối đa' },
    };

    /* ---------------- State ---------------- */
    let state = null; // xem createState()
    let selected = -1; // ô đang chọn (-1 = chưa chọn)
    let notesMode = false;
    let timerId = null;
    let hintView = null; // gợi ý đang hiển thị: { idx, value, technique, text, reason[], unit[] }
    let progress = loadProgress(); // { wins: { easy: n, ... } }

    function createState(difficulty, puzzle, solution) {
      return {
        version: 1,
        difficulty,
        puzzle: puzzle.slice(),
        solution: solution.slice(),
        board: puzzle.slice(),
        notes: new Array(Sudoku.CELLS).fill(0),
        initialGivens: puzzle.filter((v) => v !== 0).length,
        mistakes: 0,
        hintsUsed: 0,
        seconds: 0,
        history: [],
        status: 'playing', // playing | paused | won | lost
      };
    }

    /* ---------------- Tiến trình mở khóa ---------------- */
    function loadProgress() {
      const empty = { wins: {} };
      try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw) return empty;
        const p = JSON.parse(raw);
        if (!p || typeof p.wins !== 'object' || p.wins === null) return empty;
        return { wins: p.wins };
      } catch (e) {
        return empty;
      }
    }

    function saveProgress() {
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      } catch (e) {
        /* ignore */
      }
    }

    function winsOf(difficulty) {
      return progress.wins[difficulty] || 0;
    }

    /** Độ khó liền trước trong thứ tự (null nếu là độ khó đầu tiên). */
    function prevDifficulty(difficulty) {
      const i = DIFFICULTY_ORDER.indexOf(difficulty);
      return i > 0 ? DIFFICULTY_ORDER[i - 1] : null;
    }

    function isUnlocked(difficulty) {
      const prev = prevDifficulty(difficulty);
      if (!prev) return true;
      return isUnlocked(prev) && winsOf(prev) >= DIFFICULTIES[difficulty].unlockWins;
    }

    /** Ghi nhận thắng, trả về độ khó vừa được mở khóa (nếu có). */
    function recordWin(difficulty) {
      const nextKey = DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(difficulty) + 1];
      const wasUnlocked = nextKey ? isUnlocked(nextKey) : true;
      progress.wins[difficulty] = winsOf(difficulty) + 1;
      saveProgress();
      if (nextKey && !wasUnlocked && isUnlocked(nextKey)) return nextKey;
      return null;
    }

    function save() {
      if (!state) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        /* bỏ qua nếu localStorage không khả dụng */
      }
    }

    function load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (
          !s ||
          s.version !== 1 ||
          !DIFFICULTIES[s.difficulty] ||
          !Array.isArray(s.puzzle) ||
          s.puzzle.length !== Sudoku.CELLS ||
          !Array.isArray(s.solution) ||
          s.solution.length !== Sudoku.CELLS ||
          !Array.isArray(s.board) ||
          s.board.length !== Sudoku.CELLS ||
          !Array.isArray(s.notes) ||
          s.notes.length !== Sudoku.CELLS
        ) {
          return null;
        }
        if (!Array.isArray(s.history)) s.history = [];
        if (typeof s.initialGivens !== 'number') {
          // Bản lưu cũ: tính lại từ đề, trừ các ô gợi ý đã được ghi vào puzzle
          const hinted = s.history.filter((h) => h && h.hint).length;
          s.initialGivens = s.puzzle.filter((v) => v !== 0).length - hinted;
        }
        if (typeof s.hintsUsed !== 'number') {
          s.hintsUsed = s.history.filter((h) => h && h.hint).length;
        }
        return s;
      } catch (e) {
        return null;
      }
    }

    function clearSave() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        /* ignore */
      }
    }

    /* ---------------- DOM refs ---------------- */
    const $ = (id) => document.getElementById(id);
    const appEl = document.querySelector('.app');
    const boardEl = $('board');
    const numpadEl = $('numpad');
    const pauseOverlay = $('pause-overlay');
    const difficultyLabel = $('difficulty-label');
    const mistakesLabel = $('mistakes-label');
    const mistakesCount = $('mistakes-count');
    const progressFilled = $('progress-filled');
    const progressTotal = $('progress-total');
    const progressFill = $('progress-fill');
    const difficultyList = $('difficulty-list');
    const winUnlock = $('win-unlock');
    const timerLabel = $('timer-label');
    const btnPause = $('btn-pause');
    const btnResume = $('btn-resume');
    const btnNew = $('btn-new');
    const btnUndo = $('btn-undo');
    const btnErase = $('btn-erase');
    const btnNotes = $('btn-notes');
    const btnHint = $('btn-hint');
    const notesBadge = $('notes-badge');
    const hintBadge = $('hint-badge');
    const hintPanel = $('hint-panel');
    const hintTechnique = $('hint-technique');
    const hintText = $('hint-text');
    const hintValue = $('hint-value');
    const modalDifficulty = $('modal-difficulty');
    const modalWin = $('modal-win');
    const modalLose = $('modal-lose');
    const difficultyWarning = $('difficulty-warning');
    const btnDifficultyCancel = $('btn-difficulty-cancel');

    const cellEls = [];
    const noteEls = []; // noteEls[idx][d-1]
    const numEls = [];
    const countEls = [];

    /* ---------------- Build board & numpad ---------------- */
    function buildBoard() {
      boardEl.innerHTML = '';
      for (let i = 0; i < Sudoku.CELLS; i++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.idx = String(i);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Hàng ${Sudoku.ROW[i] + 1}, cột ${Sudoku.COL[i] + 1}`);
        if (Sudoku.COL[i] % 3 === 2 && Sudoku.COL[i] !== 8) cell.classList.add('box-right');
        if (Sudoku.ROW[i] % 3 === 2 && Sudoku.ROW[i] !== 8) cell.classList.add('box-bottom');

        const value = document.createElement('span');
        value.className = 'value';
        cell.appendChild(value);

        const notes = document.createElement('span');
        notes.className = 'notes';
        const spans = [];
        for (let d = 1; d <= 9; d++) {
          const s = document.createElement('span');
          s.textContent = String(d);
          notes.appendChild(s);
          spans.push(s);
        }
        cell.appendChild(notes);
        noteEls.push(spans);

        cell.addEventListener('click', () => selectCell(i));
        boardEl.appendChild(cell);
        cellEls.push(cell);
      }
    }

    function buildNumpad() {
      numpadEl.innerHTML = '';
      for (let d = 1; d <= 9; d++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'num';
        b.dataset.num = String(d);
        b.setAttribute('aria-label', `Số ${d}`);
        const label = document.createElement('span');
        label.textContent = String(d);
        const count = document.createElement('span');
        count.className = 'count';
        b.appendChild(label);
        b.appendChild(count);
        b.addEventListener('click', () => inputNumber(d));
        numpadEl.appendChild(b);
        numEls.push(b);
        countEls.push(count);
      }
    }

    /* ---------------- Render ---------------- */
    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    /** Số ô người chơi đã điền đúng / tổng số ô trống ban đầu. */
    function progressInfo() {
      const total = Sudoku.CELLS - state.initialGivens;
      let correct = 0;
      for (let i = 0; i < Sudoku.CELLS; i++) {
        if (state.board[i] !== 0 && state.board[i] === state.solution[i]) correct++;
      }
      return { filled: Math.max(0, correct - state.initialGivens), total };
    }

    function renderStatus() {
      difficultyLabel.textContent = DIFFICULTIES[state.difficulty].label;
      mistakesCount.textContent = String(state.mistakes);
      mistakesLabel.classList.toggle('warn', state.mistakes >= MAX_MISTAKES - 1);
      const { filled, total } = progressInfo();
      progressFilled.textContent = String(filled);
      progressTotal.textContent = String(total);
      progressFill.style.width = `${total ? (filled / total) * 100 : 0}%`;
      timerLabel.textContent = formatTime(state.seconds);
      const paused = state.status === 'paused';
      appEl.classList.toggle('is-paused', paused);
      pauseOverlay.hidden = !paused;
      btnPause.setAttribute('aria-label', paused ? 'Tiếp tục' : 'Tạm dừng');
      btnPause.title = paused ? 'Tiếp tục' : 'Tạm dừng';
    }

    function renderBoard() {
      const paused = state.status === 'paused';
      const selVal = selected >= 0 ? state.board[selected] : 0;
      const selRow = selected >= 0 ? Sudoku.ROW[selected] : -1;
      const selCol = selected >= 0 ? Sudoku.COL[selected] : -1;
      const selBox = selected >= 0 ? Sudoku.BOX[selected] : -1;

      for (let i = 0; i < Sudoku.CELLS; i++) {
        const cell = cellEls[i];
        const v = state.board[i];
        const given = state.puzzle[i] !== 0;
        const cls = cell.classList;

        cell.firstChild.textContent = paused || !v ? '' : String(v);
        cls.toggle('given', given);
        cls.toggle('error', !paused && v !== 0 && v !== state.solution[i]);

        const inUnit =
          selected >= 0 &&
          (Sudoku.ROW[i] === selRow || Sudoku.COL[i] === selCol || Sudoku.BOX[i] === selBox);
        cls.toggle('selected', !paused && i === selected);
        cls.toggle('same', !paused && !hintView && i !== selected && selVal !== 0 && v === selVal);
        cls.toggle('highlight', !paused && !hintView && i !== selected && inUnit && !(selVal !== 0 && v === selVal));
        cls.toggle('hint-target', !paused && !!hintView && i === hintView.idx);
        cls.toggle('hint-reason', !paused && !!hintView && hintView.reason.includes(i));
        cls.toggle('hint-unit', !paused && !!hintView && i !== hintView.idx && hintView.unit.includes(i) && !hintView.reason.includes(i));

        const mask = paused || v ? 0 : state.notes[i];
        const spans = noteEls[i];
        for (let d = 0; d < 9; d++) {
          spans[d].classList.toggle('on', (mask & (1 << d)) !== 0);
        }
      }
    }

    function renderNumpad() {
      const counts = new Array(10).fill(0);
      for (let i = 0; i < Sudoku.CELLS; i++) {
        const v = state.board[i];
        if (v && v === state.solution[i]) counts[v]++;
      }
      for (let d = 1; d <= 9; d++) {
        const left = 9 - counts[d];
        countEls[d - 1].textContent = String(left);
        numEls[d - 1].classList.toggle('done', left <= 0);
        numEls[d - 1].disabled = left <= 0;
      }
    }

    function renderTools() {
      const playing = state.status === 'playing';
      btnUndo.disabled = !playing || state.history.length === 0;
      btnErase.disabled = !playing;
      const hintsLeft = Math.max(0, MAX_HINTS - state.hintsUsed);
      btnHint.disabled = !playing || hintsLeft <= 0;
      hintBadge.textContent = String(hintsLeft);
      btnHint.title = hintsLeft > 0 ? `Còn ${hintsLeft} lượt gợi ý` : 'Đã hết lượt gợi ý';
      btnNotes.disabled = !playing;
      btnNotes.classList.toggle('active', notesMode);
      btnNotes.setAttribute('aria-pressed', String(notesMode));
      notesBadge.textContent = notesMode ? 'Bật' : 'Tắt';
      appEl.classList.toggle('notes-mode', notesMode);
    }

    function renderAll() {
      renderStatus();
      renderBoard();
      renderNumpad();
      renderTools();
    }

    /* ---------------- Timer ---------------- */
    function startTimer() {
      stopTimer();
      timerId = setInterval(() => {
        if (state && state.status === 'playing') {
          state.seconds++;
          timerLabel.textContent = formatTime(state.seconds);
          if (state.seconds % 5 === 0) save();
        }
      }, 1000);
    }

    function stopTimer() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function pauseGame() {
      if (!state || state.status !== 'playing') return;
      closeHint();
      state.status = 'paused';
      save();
      renderAll();
    }

    function resumeGame() {
      if (!state || state.status !== 'paused') return;
      state.status = 'playing';
      save();
      renderAll();
    }

    /* ---------------- Game actions ---------------- */
    function selectCell(i) {
      if (!state || state.status !== 'playing') return;
      closeHint();
      selected = i;
      renderBoard();
    }

    function pushHistory(entry) {
      state.history.push(entry);
      if (state.history.length > 500) state.history.shift();
    }

    /** Xóa số `d` khỏi ghi chú của các ô cùng hàng/cột/vùng với `idx`. */
    function clearPeerNotes(idx, d) {
      const bit = 1 << (d - 1);
      const changed = [];
      for (const p of Sudoku.PEERS[idx]) {
        if (state.notes[p] & bit) {
          changed.push({ idx: p, prevNotes: state.notes[p] });
          state.notes[p] &= ~bit;
        }
      }
      return changed;
    }

    function inputNumber(d) {
      if (!state || state.status !== 'playing') return;
      if (selected < 0) return;
      closeHint();
      const idx = selected;
      if (state.puzzle[idx] !== 0) return; // ô đề bài, không sửa
      if (state.board[idx] !== 0 && state.board[idx] === state.solution[idx]) return; // đã đúng

      if (notesMode) {
        if (state.board[idx] !== 0) return; // có số thì không ghi chú
        pushHistory({ idx, prevValue: 0, prevNotes: state.notes[idx], peers: [] });
        state.notes[idx] ^= 1 << (d - 1);
        save();
        renderBoard();
        renderTools();
        return;
      }

      if (state.board[idx] === d) return; // nhập lại cùng số, bỏ qua

      const entry = { idx, prevValue: state.board[idx], prevNotes: state.notes[idx], peers: [] };
      state.board[idx] = d;
      state.notes[idx] = 0;

      if (d === state.solution[idx]) {
        entry.peers = clearPeerNotes(idx, d);
        animateCell(idx, 'pop');
      } else {
        state.mistakes++;
        animateCell(idx, 'shake');
      }
      pushHistory(entry);

      if (state.mistakes >= MAX_MISTAKES) {
        state.status = 'lost';
        save();
        renderAll();
        showLose();
        return;
      }
      if (isSolved()) {
        finishWin();
        return;
      }
      save();
      renderAll();
    }

    function erase() {
      if (!state || state.status !== 'playing' || selected < 0) return;
      closeHint();
      const idx = selected;
      if (state.puzzle[idx] !== 0) return;
      if (state.board[idx] !== 0 && state.board[idx] === state.solution[idx]) return;
      if (state.board[idx] === 0 && state.notes[idx] === 0) return;
      pushHistory({ idx, prevValue: state.board[idx], prevNotes: state.notes[idx], peers: [] });
      state.board[idx] = 0;
      state.notes[idx] = 0;
      save();
      renderAll();
    }

    function undo() {
      if (!state || state.status !== 'playing') return;
      closeHint();
      const entry = state.history.pop();
      if (!entry) return;
      if (entry.hint) state.puzzle[entry.idx] = 0;
      state.board[entry.idx] = entry.prevValue;
      state.notes[entry.idx] = entry.prevNotes;
      for (const p of entry.peers) state.notes[p.idx] = p.prevNotes;
      selected = entry.idx;
      save();
      renderAll();
    }

    /* ---------------- Gợi ý có giải thích ---------------- */
    // Các đơn vị (hàng, cột, vùng 3x3) dùng cho suy luận
    const UNITS = [];
    for (let u = 0; u < 9; u++) {
      const row = [];
      const col = [];
      const box = [];
      for (let k = 0; k < 9; k++) {
        row.push(u * 9 + k);
        col.push(k * 9 + u);
        box.push((Math.floor(u / 3) * 3 + Math.floor(k / 3)) * 9 + (u % 3) * 3 + (k % 3));
      }
      UNITS.push({ type: 'row', index: u, cells: row });
      UNITS.push({ type: 'col', index: u, cells: col });
      UNITS.push({ type: 'box', index: u, cells: box });
    }

    function unitName(unit) {
      if (unit.type === 'row') return `hàng ${unit.index + 1}`;
      if (unit.type === 'col') return `cột ${unit.index + 1}`;
      const br = Math.floor(unit.index / 3) * 3;
      const bc = (unit.index % 3) * 3;
      return `vùng 3x3 (hàng ${br + 1}–${br + 3}, cột ${bc + 1}–${bc + 3})`;
    }

    function cellName(idx) {
      return `hàng ${Sudoku.ROW[idx] + 1}, cột ${Sudoku.COL[idx] + 1}`;
    }

    /** Bàn cờ chỉ gồm các số đúng (số sai được coi như ô trống khi suy luận). */
    function trustedBoard() {
      return state.board.map((v, i) => (v !== 0 && v === state.solution[i] ? v : 0));
    }

    /** Bitmask các số còn có thể điền vào ô idx theo bàn cờ b. */
    function candidateMask(b, idx) {
      let used = 0;
      for (const p of Sudoku.PEERS[idx]) if (b[p]) used |= 1 << (b[p] - 1);
      return 0x1ff & ~used;
    }

    /** Ô chỉ còn một số khả dĩ (naked single). */
    function nakedSingleAt(b, idx) {
      if (b[idx]) return null;
      const mask = candidateMask(b, idx);
      if (mask === 0 || mask & (mask - 1)) return null;
      const d = 31 - Math.clz32(mask) + 1;
      // Các ô đã "loại" những số khác: mỗi số khác lấy các peer đang chứa số đó
      const reason = new Set();
      const others = [];
      for (let e = 1; e <= 9; e++) {
        if (e === d) continue;
        others.push(e);
        for (const p of Sudoku.PEERS[idx]) if (b[p] === e) reason.add(p);
      }
      return {
        idx,
        value: d,
        technique: 'Ô chỉ còn một số',
        text:
          `Ô ${cellName(idx)} chỉ có thể là ${d}. ` +
          `Tám số còn lại (${others.join(', ')}) đều đã xuất hiện trong hàng, cột hoặc vùng 3x3 chứa ô này (các ô được đánh dấu vàng).`,
        reason: [...reason],
        unit: Sudoku.PEERS[idx],
      };
    }

    /** Trong một đơn vị, số d chỉ có đúng một vị trí (hidden single). */
    function hiddenSingleIn(b, unit, d) {
      const bit = 1 << (d - 1);
      if (unit.cells.some((c) => b[c] === d)) return null;
      const spots = unit.cells.filter((c) => !b[c] && candidateMask(b, c) & bit);
      if (spots.length !== 1) return null;
      const idx = spots[0];
      // Các số d đang chặn những ô trống khác trong đơn vị
      const reason = new Set();
      for (const c of unit.cells) {
        if (b[c] || c === idx) continue;
        const blocker = Sudoku.PEERS[c].find((p) => b[p] === d);
        if (blocker !== undefined) reason.add(blocker);
      }
      const name = unitName(unit);
      return {
        idx,
        value: d,
        technique: 'Số chỉ có một vị trí',
        text:
          `Trong ${name}, số ${d} chỉ có thể đặt vào ô ${cellName(idx)}. ` +
          `Mọi ô trống khác của ${name} đều nằm cùng hàng, cột hoặc vùng 3x3 với một số ${d} đã có (các ô được đánh dấu vàng), nên không thể chứa ${d}.`,
        reason: [...reason],
        unit: unit.cells,
      };
    }

    /** Tìm bước gợi ý tốt nhất kèm giải thích. */
    function findHint() {
      // 1. Có số sai trên bàn cờ: chỉ ra ô sai trước
      const wrong = [];
      for (let i = 0; i < Sudoku.CELLS; i++) {
        if (state.board[i] !== 0 && state.board[i] !== state.solution[i]) wrong.push(i);
      }
      if (wrong.length) {
        const idx = wrong.includes(selected) ? selected : wrong[0];
        return {
          idx,
          value: state.solution[idx],
          technique: 'Có số sai',
          text: `Số ${state.board[idx]} ở ô ${cellName(idx)} không đúng, đáp án của ô này là ${state.solution[idx]}. Hãy sửa ô sai trước khi suy luận tiếp.`,
          reason: [],
          unit: [],
        };
      }

      const b = trustedBoard();
      // 2. Ưu tiên ô đang chọn nếu có thể suy luận ngay tại đó
      if (selected >= 0 && !b[selected]) {
        const ns = nakedSingleAt(b, selected);
        if (ns) return ns;
        for (const unit of UNITS) {
          if (!unit.cells.includes(selected)) continue;
          const hs = hiddenSingleIn(b, unit, state.solution[selected]);
          if (hs && hs.idx === selected) return hs;
        }
      }
      // 3. Quét toàn bàn: naked single trước, rồi hidden single
      for (let i = 0; i < Sudoku.CELLS; i++) {
        const ns = nakedSingleAt(b, i);
        if (ns) return ns;
      }
      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          const hs = hiddenSingleIn(b, unit, d);
          if (hs) return hs;
        }
      }
      // 4. Không có bước đơn giản: đưa đáp án của ô đang chọn (hoặc ô trống đầu tiên)
      let idx = selected >= 0 && !b[selected] ? selected : b.indexOf(0);
      if (idx < 0) return null;
      return {
        idx,
        value: state.solution[idx],
        technique: 'Cần kỹ thuật nâng cao',
        text: `Ở trạng thái hiện tại không có ô nào suy ra được bằng hai kỹ thuật cơ bản (ô chỉ còn một số, số chỉ có một vị trí). Đáp án của ô ${cellName(idx)} là ${state.solution[idx]}.`,
        reason: [],
        unit: [],
      };
    }

    function hint() {
      if (!state || state.status !== 'playing') return;
      if (state.hintsUsed >= MAX_HINTS) return;
      const h = findHint();
      if (!h) return;
      state.hintsUsed++; // lượt gợi ý tính từ lúc xem, không hoàn lại
      hintView = h;
      selected = h.idx;
      hintTechnique.textContent = h.technique;
      hintText.textContent = h.text;
      hintValue.textContent = String(h.value);
      hintPanel.hidden = false;
      save();
      renderAll();
      hintPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function closeHint() {
      if (!hintView) return;
      hintView = null;
      hintPanel.hidden = true;
      renderBoard();
    }

    function applyHint() {
      if (!hintView || !state || state.status !== 'playing') return;
      const { idx, value: d } = hintView;
      closeHint();
      if (state.board[idx] === d) return;
      const entry = { idx, prevValue: state.board[idx], prevNotes: state.notes[idx], peers: [], hint: true };
      state.board[idx] = d;
      state.notes[idx] = 0;
      state.puzzle[idx] = d; // gợi ý được coi như ô đề bài
      entry.peers = clearPeerNotes(idx, d);
      pushHistory(entry);
      selected = idx;
      animateCell(idx, 'pop');

      if (isSolved()) {
        finishWin();
        return;
      }
      save();
      renderAll();
    }

    function animateCell(idx, cls) {
      const el = cellEls[idx];
      el.classList.remove('pop', 'shake');
      void el.offsetWidth; // ép trình duyệt tính lại để chạy lại animation
      el.classList.add(cls);
    }

    function toggleNotes() {
      if (!state || state.status !== 'playing') return;
      notesMode = !notesMode;
      renderTools();
    }

    function isSolved() {
      for (let i = 0; i < Sudoku.CELLS; i++) {
        if (state.board[i] !== state.solution[i]) return false;
      }
      return true;
    }

    function moveSelection(dr, dc) {
      if (!state || state.status !== 'playing') return;
      if (selected < 0) {
        selectCell(0);
        return;
      }
      const r = (Sudoku.ROW[selected] + dr + 9) % 9;
      const c = (Sudoku.COL[selected] + dc + 9) % 9;
      selectCell(r * 9 + c);
    }

    /* ---------------- New game / retry ---------------- */
    function newGame(difficulty) {
      closeHint();
      const target = DIFFICULTIES[difficulty].givens;
      const { puzzle, solution } = Sudoku.generatePuzzle(target);
      state = createState(difficulty, puzzle, solution);
      selected = -1;
      notesMode = false;
      save();
      renderAll();
      startTimer();
    }

    function retryGame() {
      if (!state) return;
      closeHint();
      // Khôi phục đề gốc: bỏ các ô gợi ý đã được ghi vào puzzle
      for (const entry of state.history) {
        if (entry.hint) state.puzzle[entry.idx] = 0;
      }
      state.board = state.puzzle.slice();
      state.notes = new Array(Sudoku.CELLS).fill(0);
      state.mistakes = 0;
      state.hintsUsed = 0;
      state.seconds = 0;
      state.history = [];
      state.status = 'playing';
      selected = -1;
      notesMode = false;
      save();
      renderAll();
      startTimer();
    }

    /* ---------------- Modals ---------------- */
    function showModal(el) {
      el.hidden = false;
    }
    function hideModal(el) {
      el.hidden = true;
    }

    const LOCK_SVG =
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V6z"/></svg>';
    const TROPHY_SVG =
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1H5a2 2 0 0 0-2 2v1a5 5 0 0 0 4.4 4.96A6 6 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1a6 6 0 0 0 3.6-3.94A5 5 0 0 0 21 7V6a2 2 0 0 0-2-2zM5 7V6h2v3.83A3 3 0 0 1 5 7zm14 0a3 3 0 0 1-2 2.83V6h2v1z"/></svg>';

    function buildDifficultyList() {
      difficultyList.innerHTML = '';
      for (const key of DIFFICULTY_ORDER) {
        const info = DIFFICULTIES[key];
        const unlocked = isUnlocked(key);
        const prev = prevDifficulty(key);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'difficulty-option';
        btn.dataset.difficulty = key;
        btn.disabled = !unlocked;
        if (state && state.difficulty === key) btn.classList.add('current');

        let dots = '';
        for (let i = 1; i <= 5; i++) dots += `<i class="${i <= info.level ? 'on' : ''}"></i>`;

        let badge;
        if (unlocked) {
          const wins = winsOf(key);
          badge = `<span class="difficulty-badge wins">${TROPHY_SVG}${wins}</span>`;
        } else {
          badge = `<span class="difficulty-badge locked">${LOCK_SVG}Khóa</span>`;
        }
        const desc = unlocked
          ? info.desc
          : `Thắng ${info.unlockWins} ván ${DIFFICULTIES[prev].label} để mở (${Math.min(winsOf(prev), info.unlockWins)}/${info.unlockWins})`;

        btn.innerHTML = `
          <span class="difficulty-dots" aria-hidden="true">${dots}</span>
          <span class="difficulty-text">
            <span class="difficulty-name">${info.label}</span>
            <span class="difficulty-desc">${desc}</span>
          </span>
          ${badge}`;
        btn.setAttribute('aria-label', unlocked ? info.label : `${info.label} (đang khóa)`);
        btn.addEventListener('click', () => {
          if (!isUnlocked(key)) return;
          hideModal(modalDifficulty);
          hideModal(modalWin);
          hideModal(modalLose);
          // Trì hoãn một nhịp để modal đóng trước khi sinh đề
          setTimeout(() => newGame(key), 20);
        });
        difficultyList.appendChild(btn);
      }
    }

    function showDifficultyPicker() {
      const inProgress = state && (state.status === 'playing' || state.status === 'paused');
      difficultyWarning.hidden = !inProgress;
      btnDifficultyCancel.hidden = !state;
      if (state && state.status === 'playing') pauseGame();
      buildDifficultyList();
      showModal(modalDifficulty);
    }

    function showWin(unlockedKey) {
      stopTimer();
      $('win-difficulty').textContent = DIFFICULTIES[state.difficulty].label;
      $('win-time').textContent = formatTime(state.seconds);
      $('win-mistakes').textContent = String(state.mistakes);
      if (unlockedKey) {
        winUnlock.textContent = `🔓 Đã mở khóa độ khó ${DIFFICULTIES[unlockedKey].label}!`;
        winUnlock.hidden = false;
      } else {
        winUnlock.hidden = true;
      }
      showModal(modalWin);
    }

    /** Chuyển ván sang trạng thái thắng, ghi nhận tiến trình và hiện modal. */
    function finishWin() {
      state.status = 'won';
      const unlockedKey = recordWin(state.difficulty);
      state.unlocked = unlockedKey || null;
      save();
      renderAll();
      showWin(unlockedKey);
    }

    function showLose() {
      stopTimer();
      showModal(modalLose);
    }

    /* ---------------- Events ---------------- */
    btnNew.addEventListener('click', showDifficultyPicker);
    btnPause.addEventListener('click', () => {
      if (!state) return;
      if (state.status === 'playing') pauseGame();
      else if (state.status === 'paused') resumeGame();
    });
    btnResume.addEventListener('click', resumeGame);
    btnUndo.addEventListener('click', undo);
    btnErase.addEventListener('click', erase);
    btnNotes.addEventListener('click', toggleNotes);
    btnHint.addEventListener('click', hint);
    $('btn-hint-apply').addEventListener('click', applyHint);
    $('btn-hint-close').addEventListener('click', closeHint);
    $('btn-hint-self').addEventListener('click', closeHint);

    modalDifficulty.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!state) return; // chưa có ván nào thì không cho đóng
        hideModal(modalDifficulty);
        if (state.status === 'paused') resumeGame();
      });
    });

    $('btn-win-new').addEventListener('click', () => {
      hideModal(modalWin);
      showDifficultyPicker();
    });
    $('btn-lose-new').addEventListener('click', () => {
      hideModal(modalLose);
      showDifficultyPicker();
    });
    $('btn-lose-retry').addEventListener('click', () => {
      hideModal(modalLose);
      retryGame();
    });

    document.addEventListener('keydown', (e) => {
      if (!state) return;
      if (!modalDifficulty.hidden || !modalWin.hidden || !modalLose.hidden) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;
      if (key >= '1' && key <= '9') {
        inputNumber(Number(key));
        e.preventDefault();
      } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
        erase();
        e.preventDefault();
      } else if (key === 'ArrowUp') {
        moveSelection(-1, 0);
        e.preventDefault();
      } else if (key === 'ArrowDown') {
        moveSelection(1, 0);
        e.preventDefault();
      } else if (key === 'ArrowLeft') {
        moveSelection(0, -1);
        e.preventDefault();
      } else if (key === 'ArrowRight') {
        moveSelection(0, 1);
        e.preventDefault();
      } else if (key === 'n' || key === 'N') {
        toggleNotes();
        e.preventDefault();
      } else if (key === 'z' || key === 'Z') {
        undo();
        e.preventDefault();
      } else if (key === 'h' || key === 'H') {
        hint();
        e.preventDefault();
      } else if (key === 'Escape' && hintView) {
        closeHint();
        e.preventDefault();
      } else if (key === 'p' || key === 'P' || key === 'Escape') {
        if (state.status === 'playing') pauseGame();
        else if (state.status === 'paused') resumeGame();
        e.preventDefault();
      }
    });

    // Tự tạm dừng khi chuyển tab / ẩn trang
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state && state.status === 'playing') pauseGame();
    });
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);

    /* ---------------- Init ---------------- */
    function init() {
      buildBoard();
      buildNumpad();
      const saved = load();
      if (saved) {
        state = saved;
        if (state.status === 'won') {
          renderAll();
          showWin(state.unlocked || null);
        } else if (state.status === 'lost') {
          renderAll();
          showLose();
        } else {
          // Mở lại trang: bắt đầu ở trạng thái tạm dừng để người chơi chủ động tiếp tục
          state.status = 'paused';
          renderAll();
          startTimer();
        }
      } else {
        clearSave();
        // Hiển thị bàn cờ trống + modal chọn độ khó
        state = null;
        btnUndo.disabled = true;
        btnErase.disabled = true;
        btnHint.disabled = true;
        btnNotes.disabled = true;
        showDifficultyPicker();
      }
    }

    init();
  })();
}
