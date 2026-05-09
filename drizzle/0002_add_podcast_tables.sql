-- Add visitor_logs table
CREATE TABLE IF NOT EXISTS `visitor_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_address` text,
	`country` text,
	`city` text,
	`user_agent` text,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Add guests table
CREATE TABLE IF NOT EXISTS `guests` (
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
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Add episodes table
CREATE TABLE IF NOT EXISTS `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Add episode_notes table
CREATE TABLE IF NOT EXISTS `episode_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`content` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`replaced_by_note` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`replaced_by_note`) REFERENCES `episode_notes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Add research table
CREATE TABLE IF NOT EXISTS `research` (
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
