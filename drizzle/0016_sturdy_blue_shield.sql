CREATE TABLE IF NOT EXISTS `podcast_audio` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`duration_ms` integer,
	`size_bytes` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `chat_trump_policy_mentions` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `episode_tag_map` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `episode_transcript_lines` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `policy_scoring` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `research` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `trump_policy_pages` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `trump_policy_page_episode_map` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `trump_policy_page_guest_map` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `trump_policy_page_tag_map` ADD `is_active` integer DEFAULT true NOT NULL;