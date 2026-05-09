ALTER TABLE `episodes` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `replaced_by` text REFERENCES episodes(id);--> statement-breakpoint
ALTER TABLE `guests` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `guests` ADD `replaced_by` text REFERENCES guests(id);--> statement-breakpoint
ALTER TABLE `research` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `research` ADD `replaced_by` text REFERENCES research(id);