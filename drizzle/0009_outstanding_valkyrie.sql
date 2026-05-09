ALTER TABLE `episode_notes` ADD `title` text DEFAULT 'Note' NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `transcript` text;