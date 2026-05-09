CREATE TABLE IF NOT EXISTS `trump_policy_page` (
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
CREATE UNIQUE INDEX `trump_policy_page_uuid_unique` ON `trump_policy_page` (`uuid`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_page_podcast_episode_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`episode_id` text NOT NULL,
	`source` text NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_page`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_page_podcast_guest_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`guest_id` text NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_page`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_page_research_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`research_id` text NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_page`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`research_id`) REFERENCES `research`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_page_tag_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`ai_rationale` text,
	FOREIGN KEY (`tag_id`) REFERENCES `trump_policy_tag`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer,
	`type_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `trump_policy_tag_type`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trump_policy_tag_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL
);
