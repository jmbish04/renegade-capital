CREATE TABLE IF NOT EXISTS `policy_scoring` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`racial_equity_score` integer,
	`racial_equity_rationale` text,
	`economic_justice_score` integer,
	`economic_justice_rationale` text,
	`algorithmic_bias_score` integer,
	`algorithmic_bias_rationale` text,
	`labor_rights_score` integer,
	`labor_rights_rationale` text,
	`privacy_surveillance_score` integer,
	`privacy_surveillance_rationale` text,
	`overall_impact_score` integer,
	`overall_rationale` text,
	FOREIGN KEY (`page_id`) REFERENCES `trump_policy_page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `episode_transcript_lines` ADD `cue` text;--> statement-breakpoint
ALTER TABLE `guests` ADD `preferred_voice` text;