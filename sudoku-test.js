/* Kiểm tra engine: chạy `node sudoku-test.js [số ván mỗi độ khó]`
 * - Lưới đầy hợp lệ
 * - Đề sinh ra khớp với đáp án
 * - Mỗi đề có đúng một nghiệm và solver tìm lại đúng đáp án
 * - Số ô cho trước không vượt xa mục tiêu
 */
const Sudoku = require('./app.js');

const ROUNDS = Number(process.argv[2]) || 20;
const DIFFICULTIES = {
  easy: 40,
  medium: 34,
  hard: 29,
  expert: 25,
  extreme: 22,
};

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

function isValidFull(grid) {
  if (grid.length !== 81) return false;
  for (let u = 0; u < 9; u++) {
    const row = new Set();
    const col = new Set();
    const box = new Set();
    for (let k = 0; k < 9; k++) {
      const rv = grid[u * 9 + k];
      const cv = grid[k * 9 + u];
      const br = Math.floor(u / 3) * 3 + Math.floor(k / 3);
      const bc = (u % 3) * 3 + (k % 3);
      const bv = grid[br * 9 + bc];
      if (rv < 1 || rv > 9 || cv < 1 || cv > 9 || bv < 1 || bv > 9) return false;
      row.add(rv);
      col.add(cv);
      box.add(bv);
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9) return false;
  }
  return true;
}

let total = 0;
const t0 = Date.now();
for (const [name, target] of Object.entries(DIFFICULTIES)) {
  let sumGivens = 0;
  let maxGivens = 0;
  let sumMs = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const start = Date.now();
    const { puzzle, solution, givens } = Sudoku.generatePuzzle(target);
    sumMs += Date.now() - start;

    assert(isValidFull(solution), `[${name}#${r}] đáp án không hợp lệ`);
    const actualGivens = puzzle.filter((v) => v !== 0).length;
    assert(actualGivens === givens, `[${name}#${r}] số ô cho trước không khớp`);
    for (let i = 0; i < 81; i++) {
      assert(puzzle[i] === 0 || puzzle[i] === solution[i], `[${name}#${r}] ô ${i} không khớp đáp án`);
    }
    assert(Sudoku.countSolutions(puzzle, 2) === 1, `[${name}#${r}] đề không có nghiệm duy nhất`);
    const solved = Sudoku.solve(puzzle);
    assert(solved && solved.every((v, i) => v === solution[i]), `[${name}#${r}] solver giải sai`);
    assert(givens <= target + 4, `[${name}#${r}] quá nhiều ô cho trước: ${givens} (mục tiêu ${target})`);

    sumGivens += givens;
    maxGivens = Math.max(maxGivens, givens);
    total++;
  }
  console.log(
    `${name.padEnd(8)} mục tiêu ${target} | TB ô cho trước ${(sumGivens / ROUNDS).toFixed(1)} | max ${maxGivens} | TB ${(sumMs / ROUNDS).toFixed(0)} ms/đề`
  );
}

// Kiểm tra solver nhận biết đề nhiều nghiệm
const empty = new Array(81).fill(0);
assert(Sudoku.countSolutions(empty, 2) === 2, 'lưới trống phải có >= 2 nghiệm');
const conflict = new Array(81).fill(0);
conflict[0] = 1;
conflict[1] = 1;
assert(Sudoku.countSolutions(conflict, 2) === 0, 'lưới mâu thuẫn phải vô nghiệm');

console.log(`\nOK: ${total} đề, tất cả đều có đúng một nghiệm. Tổng ${((Date.now() - t0) / 1000).toFixed(1)}s`);
