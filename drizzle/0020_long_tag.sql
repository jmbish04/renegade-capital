ALTER TABLE `episode_transcript_lines` ADD `is_host` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `episode_transcript_lines` ADD `is_guest` integer DEFAULT false NOT NULL;