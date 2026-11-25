import type { Clock } from "./clock";
import { Chess } from "./chess/engine.js";
export type Side = "w" | "b";
export type Game = { clock?: Clock|null; serverNow?:number; id: string; moves: string[]; joined: boolean; resigned: Side | null; revision: number; side: Side | null };
export function position(moves: string[]) {
  const game = new Chess();
  for (const san of moves) game.move(san);
  return game;
}
export function ending(game: Chess, resigned: Side | null) {
  if (resigned) return resigned === "w" ? "Black wins by resignation" : "White wins by resignation";
  if (game.isCheckmate()) return game.turn() === "w" ? "Black wins by checkmate" : "White wins by checkmate";
  if (game.isStalemate()) return "Draw by stalemate";
  if (game.isInsufficientMaterial()) return "Draw by insufficient material";
  if (game.isThreefoldRepetition()) return "Draw by repetition";
  if (game.isDrawByFiftyMoves()) return "Draw by fifty-move rule";
  return "";
}
