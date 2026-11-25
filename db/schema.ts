import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("chess_rooms", {
  id: text("id").primaryKey(),
  white: text("white").notNull(),
  black: text("black"),
  moves: text("moves").notNull().default("[]"),
  clock: text("clock"),
  resigned: text("resigned"),
  revision: integer("revision").notNull().default(0)
});
