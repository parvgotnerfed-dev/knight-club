CREATE TABLE `chess_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`white` text NOT NULL,
	`black` text,
	`moves` text DEFAULT '[]' NOT NULL,
	`resigned` text,
	`revision` integer DEFAULT 0 NOT NULL
);
