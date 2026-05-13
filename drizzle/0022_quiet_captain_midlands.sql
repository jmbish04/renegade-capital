CREATE TABLE IF NOT EXISTS `episode_host_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`host_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`host_id`) REFERENCES `hosts`(`id`) ON UPDATE no action ON DELETE cascade
);
