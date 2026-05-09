DROP TABLE `chat_trump_policy_mentions`;--> statement-breakpoint
DROP TABLE `episode_guest_map`;--> statement-breakpoint
DROP TABLE `episode_transcript_lines`;--> statement-breakpoint
DROP TABLE `episode_transcript_topics`;--> statement-breakpoint
DROP TABLE `policy_scoring`;--> statement-breakpoint
DROP TABLE `trump_policy_page`;--> statement-breakpoint
DROP TABLE `trump_policy_page_podcast_episode_map`;--> statement-breakpoint
DROP TABLE `trump_policy_page_podcast_guest_map`;--> statement-breakpoint
DROP TABLE `trump_policy_page_research_map`;--> statement-breakpoint
DROP TABLE `trump_policy_page_tag_map`;--> statement-breakpoint
DROP TABLE `trump_policy_tag`;--> statement-breakpoint
DROP TABLE `trump_policy_tag_type`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__new_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_episodes`("id", "title", "description", "created_at") SELECT "id", "title", "description", "created_at" FROM `episodes`;--> statement-breakpoint
DROP TABLE `episodes`;--> statement-breakpoint
ALTER TABLE `__new_episodes` RENAME TO `episodes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__new_guests` (
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
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_guests`("id", "name", "persona_description", "expertise", "tone", "background", "chemistry", "domain", "headshot_url", "affiliation", "podcast_fit_rationale", "created_at") SELECT "id", "name", "persona_description", "expertise", "tone", "background", "chemistry", "domain", "headshot_url", "affiliation", "podcast_fit_rationale", "created_at" FROM `guests`;--> statement-breakpoint
DROP TABLE `guests`;--> statement-breakpoint
ALTER TABLE `__new_guests` RENAME TO `guests`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__new_research` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`chemistry` text NOT NULL,
	`topic` text NOT NULL,
	`link` text NOT NULL,
	`date_added` integer,
	`headshot_url` text,
	`affiliation` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_research`("id", "name", "domain", "chemistry", "topic", "link", "date_added", "headshot_url", "affiliation", "created_at") SELECT "id", "name", "domain", "chemistry", "topic", "link", "date_added", "headshot_url", "affiliation", "created_at" FROM `research`;--> statement-breakpoint
DROP TABLE `research`;--> statement-breakpoint
ALTER TABLE `__new_research` RENAME TO `research`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__new_health_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`message` text,
	`duration_ms` integer,
	`details` text,
	`ai_suggestion` text,
	`timestamp` text,
	FOREIGN KEY (`run_id`) REFERENCES `health_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_health_results`("id", "run_id", "category", "name", "status", "message", "duration_ms", "details", "ai_suggestion", "timestamp") SELECT "id", "run_id", "category", "name", "status", "message", "duration_ms", "details", "ai_suggestion", "timestamp" FROM `health_results`;--> statement-breakpoint
DROP TABLE `health_results`;--> statement-breakpoint
ALTER TABLE `__new_health_results` RENAME TO `health_results`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__new_health_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`duration_ms` integer,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_health_runs`("id", "status", "trigger", "duration_ms", "metadata", "created_at") SELECT "id", "status", "trigger", "duration_ms", "metadata", "created_at" FROM `health_runs`;--> statement-breakpoint
DROP TABLE `health_runs`;--> statement-breakpoint
ALTER TABLE `__new_health_runs` RENAME TO `health_runs`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__new_threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_threads`("id", "user_id", "title", "created_at", "updated_at") SELECT "id", "user_id", "title", "created_at", "updated_at" FROM `threads`;--> statement-breakpoint
DROP TABLE `threads`;--> statement-breakpoint
ALTER TABLE `__new_threads` RENAME TO `threads`;--> statement-breakpoint
ALTER TABLE `episode_notes` DROP COLUMN `title`;