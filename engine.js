export const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

export const CENTER_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 5, 10, 10, 10, 10, 5, 0],
  [0, 10, 20, 25, 25, 20, 10, 0],
  [0, 10, 25, 35, 35, 25, 10, 0],
  [0, 10, 25, 35, 35, 25, 10, 0],
  [0, 10, 20, 25, 25, 20, 10, 0],
  [0, 5, 10, 10, 10, 10, 5, 0],
  [0, 0, 0, 0, 0, 0, 0, 0]
];

export class ChessGameEngine {
  constructor(ChessCtor) {
    if (!ChessCtor) throw new Error('Chess.js não foi carregado.');
    this.ChessCtor = ChessCtor;
    this.chess = new ChessCtor();
    this.mode = 'ai';
    this.difficulty = 'medium';
  }

  reset() {
    this.chess.reset();
  }

  load(fen) {
    return this.chess.load(fen);
  }

  fen() {
    return this.chess.fen();
  }

  board() {
    return this.chess.board();
  }

  turn() {
    return this.chess.turn();
  }

  history(options) {
    return this.chess.history(options);
  }

  get(square) {
    return this.chess.get(square) || null;
  }

  moves(options) {
    return this.chess.moves(options);
  }

  setMode(mode) {
    if (!['ai', 'pvp'].includes(mode)) throw new Error(`Modo inválido: ${mode}`);
    this.mode = mode;
  }

  setDifficulty(difficulty) {
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new Error(`Dificuldade inválida: ${difficulty}`);
    }
    this.difficulty = difficulty;
  }

  move(from, to, promotion = 'q') {
    return this.chess.move({ from, to, promotion }) || null;
  }

  undoForCurrentMode() {
    const first = this.chess.undo();
    if (!first) return [];

    const undone = [first];
    if (this.mode === 'ai' && this.chess.turn() === 'b') {
      const second = this.chess.undo();
      if (second) undone.push(second);
    }
    return undone;
  }

  gameOver() {
    return this.chess.game_over();
  }

  inCheck() {
    return this.chess.in_check();
  }

  inCheckmate() {
    return this.chess.in_checkmate();
  }

  inDraw() {
    return this.chess.in_draw() || this.chess.in_stalemate() || this.chess.in_threefold_repetition();
  }

  evaluateBoard() {
    if (this.chess.game_over()) {
      if (this.chess.in_checkmate()) {
        return this.chess.turn() === 'w' ? 1_000_000 : -1_000_000;
      }
      return 0;
    }

    const board = this.chess.board();
    let score = 0;
    for (let r = 0; r < 8; r += 1) {
      for (let f = 0; f < 8; f += 1) {
        const piece = board[r][f];
        if (!piece) continue;
        const value = PIECE_VALUES[piece.type] + CENTER_BONUS[r][f];
        score += piece.color === 'b' ? value : -value;
      }
    }
    return score;
  }

  minimax(depth, alpha, beta, isMaximizing) {
    if (this.chess.game_over()) {
      if (this.chess.in_checkmate()) {
        return this.chess.turn() === 'w'
          ? 1_000_000 + depth
          : -1_000_000 - depth;
      }
      return 0;
    }

    if (depth === 0) return this.evaluateBoard();

    const moves = this.chess.moves({ verbose: true });

    if (isMaximizing) {
      let best = -Infinity;
      for (const move of moves) {
        this.chess.move(move);
        best = Math.max(best, this.minimax(depth - 1, alpha, beta, false));
        this.chess.undo();
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }

    let best = Infinity;
    for (const move of moves) {
      this.chess.move(move);
      best = Math.min(best, this.minimax(depth - 1, alpha, beta, true));
      this.chess.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  chooseAiMove(random = Math.random) {
    const moves = this.chess.moves({ verbose: true });
    if (!moves.length) return null;

    if (this.difficulty === 'easy') {
      const captures = moves.filter((move) => move.captured);
      if (captures.length && random() < 0.25) {
        return captures[Math.floor(random() * captures.length)];
      }
      return moves[Math.floor(random() * moves.length)];
    }

    if (this.difficulty === 'medium') {
      let chosen = moves[0];
      let bestScore = -Infinity;
      for (const move of moves) {
        this.chess.move(move);
        const score = this.evaluateBoard() + (random() * 25 - 12);
        this.chess.undo();
        if (score > bestScore) {
          bestScore = score;
          chosen = move;
        }
      }
      return chosen;
    }

    const ordered = [...moves].sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)));
    let chosen = ordered[0];
    let bestScore = -Infinity;

    for (const move of ordered) {
      this.chess.move(move);
      const score = this.minimax(2, -Infinity, Infinity, false);
      this.chess.undo();
      if (score > bestScore) {
        bestScore = score;
        chosen = move;
      }
    }
    return chosen;
  }

  playAiMove(random = Math.random) {
    const move = this.chooseAiMove(random);
    if (!move) return null;
    return this.chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  }
}
