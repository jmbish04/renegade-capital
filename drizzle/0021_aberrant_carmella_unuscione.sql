CREATE TABLE IF NOT EXISTS `hosts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`persona_description` text NOT NULL,
	`expertise` text NOT NULL,
	`tone` text NOT NULL,
	`background` text NOT NULL,
	`chemistry` text NOT NULL,
	`domain` text NOT NULL,
	`headshot_url` text,
	`affiliation` text,
	`podcast_fit_rationale` text,
	`sex` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `episode_transcript_lines` ADD `host_id` text REFERENCES hosts(id);--> statement-breakpoint
ALTER TABLE `episode_transcript_lines` DROP COLUMN `speaker_source`;