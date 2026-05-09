CREATE TABLE IF NOT EXISTS `chat_trump_policy_mentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`policy_page_id` integer NOT NULL,
	`ai_rationale` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`policy_page_id`) REFERENCES `trump_policy_page`(`id`) ON UPDATE no action ON DELETE no action
);
