CREATE TABLE IF NOT EXISTS `chat_trump_policy_mentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`policy_page_id` integer NOT NULL,
	`ai_rationale` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`policy_page_id`) REFERENCES `trump_policy_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `episode_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type_id` integer NOT NULL,
	`parent_id` integer,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `episode_tag_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `episode_tag_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `episode_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `episode_tag_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_tag_types_name_unique` ON `episode_tag_types` (`name`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `episode_transcript_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`speaker_source` text NOT NULL,
	`guest_id` text,
	`transcript_line` text NOT NULL,
	`cue` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `policy_scoring` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`racial_equity` real,
	`economic_justice` real,
	`algorithmic_bias` real,
	`labor_rights` real,
	`privacy_surveillance` real,
	`overall_impact_score` real,
	`overall_rationale` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`page_num` integer NOT NULL,
	`page_content` text NOT NULL,
	`r2_key` text,
	`page_image_url` text,
	`ai_summary` text,
	`ai_analysis` text,
	`ai_rationale` text,
	`ai_organize_tech` text,
	`ai_organize_finance` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trump_policy_pages_uuid_unique` ON `trump_policy_pages` (`uuid`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_page_episode_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`episode_id` text NOT NULL,
	`source` text,
	`ai_rationale` text,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_page_guest_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`guest_id` text NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_page_tag_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `trump_policy_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type_id` integer NOT NULL,
	`parent_id` integer,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `trump_policy_tag_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_tag_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trump_policy_tag_types_name_unique` ON `trump_policy_tag_types` (`name`);