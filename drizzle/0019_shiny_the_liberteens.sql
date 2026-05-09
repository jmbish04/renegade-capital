ALTER TABLE `episode_transcript_lines` ADD `transcript_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `podcast_audio` ADD `transcript_id` text DEFAULT '' NOT NULL;