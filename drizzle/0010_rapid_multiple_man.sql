CREATE TABLE IF NOT EXISTS `episode_guest_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `episode_transcript_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`topic_id` integer,
	`speaker_source` text NOT NULL,
	`guest_id` text,
	`transcript_line` text NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `episode_transcript_topics`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `episode_transcript_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`topic_name` text NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `episodes` DROP COLUMN `transcript`;--> statement-breakpoint
ALTER TABLE `trump_policy_page` DROP COLUMN `transcript`;