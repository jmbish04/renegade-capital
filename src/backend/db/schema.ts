/**
 * @fileoverview Database schema definitions using drizzle-orm.
 *
 * This file defines the database schema using drizzle-orm for the complete application.
 * It includes tables for authentication, dashboard metrics, AI threads, and system health.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Users table for authentication
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Sessions table for managing user sessions
 */
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Dashboard metrics table
 */
export const dashboardMetrics = sqliteTable("dashboard_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metricName: text("metric_name").notNull(),
  metricValue: real("metric_value").notNull(),
  metricType: text("metric_type").notNull(), // 'count', 'percentage', 'currency', 'time'
  category: text("category").notNull(), // 'users', 'revenue', 'performance', 'system'
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * AI Thread table for assistant conversations
 */
export const threads = sqliteTable("threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Messages table for thread conversations
 */
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON string for attachments, tool calls, etc.
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * System health checks table
 */
export const healthChecks = sqliteTable("health_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceName: text("service_name").notNull(),
  status: text("status").notNull(), // 'healthy', 'degraded', 'down'
  responseTime: integer("response_time"), // in milliseconds
  errorMessage: text("error_message"),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Notifications table for system alerts
 */
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'info', 'warning', 'error', 'success'
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * PlateJS documents table
 */
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(), // JSON string of Slate nodes
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Visitor logs table for analytics
 */
export const visitorLogs = sqliteTable("visitor_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ipAddress: text("ip_address"),
  country: text("country"),
  city: text("city"),
  userAgent: text("user_agent"),
  path: text("path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Podcast guests table for the Renegade Capital platform
 */
export const guests = sqliteTable("guests", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  personaDescription: text("persona_description").notNull(),
  expertise: text("expertise").notNull(), // JSON array string
  tone: text("tone").notNull(),
  background: text("background").notNull(),
  chemistry: text("chemistry").notNull(), // JSON array string
  domain: text("domain").notNull(), // JSON array string
  headshotUrl: text("headshot_url"),
  affiliation: text("affiliation"),
  podcastFitRationale: text("podcast_fit_rationale"),
  sex: text("sex", { enum: ["M", "F", "Other"] }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Episodes table for the Renegade Capital platform
 */
export const episodes = sqliteTable("episodes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  artworkUrl: text("artwork_url"),
  coverPhotoUrl: text("cover_photo_url"),
  socialJusticeInvestmentTopics: text("social_justice_investment_topics"),
  aiSocialJusticeTopics: text("ai_social_justice_topics"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Episode Tag Type
 */
export const episodeTagType = sqliteTable("episode_tag_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // e.g., Educational, Organize a Movement, Social Justice (Finance), Social Justice (AI), etc
  parentId: integer("parent_id"), // So that we can create a hierarchy of tags, i.e., Policy -> Healthcare Policy -> Universal Healthcare
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Episode Tag
 */
export const episodeTag = sqliteTable("episode_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  typeId: integer("type_id").notNull().references(() => episodeTagType.id, { onDelete: "cascade" }), // e.g., Educational, Organize a Movement, Social Justice (Finance), Social Justice (AI), etc
  parentId: integer("parent_id"), // So that we can create a hierarchy of tags, i.e., Policy -> Healthcare Policy -> Universal Healthcare
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Episode Page <-> Tag Mapping
 */
export const episodeTagMap = sqliteTable("episode_tag_map", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  episodeId: text("episode_id").notNull().references(() => episodes.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => episodeTag.id, { onDelete: "cascade" }),
  aiRationale: text("ai_rationale"), // why add the tag selected
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});



/**
 * Episode notes table for contextual notes on podcast matchups
 */
export const episodeNotes = sqliteTable("episode_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  replacedByNote: integer("replaced_by_note").references((): any => episodeNotes.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Research table for the Renegade Capital platform
 */
export const research = sqliteTable("research", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  chemistry: text("chemistry").notNull(),
  topic: text("topic").notNull(),
  link: text("link").notNull(),
  dateAdded: integer("date_added", { mode: "timestamp" }),
  headshotUrl: text("headshot_url"),
  affiliation: text("affiliation"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Health check run aggregation table.
 * Each run is a suite-level execution that groups individual check results.
 */
export const healthRuns = sqliteTable("health_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(), // 'healthy', 'degraded', 'unhealthy', 'unknown'
  trigger: text("trigger").notNull(), // 'manual', 'scheduled', 'api'
  durationMs: integer("duration_ms"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Individual health check results linked to a health run.
 */
export const healthResults = sqliteTable("health_results", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => healthRuns.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(), // 'success', 'failure'
  message: text("message"),
  durationMs: integer("duration_ms"),
  details: text("details", { mode: "json" }),
  aiSuggestion: text("ai_suggestion"),
  timestamp: text("timestamp"),
});

/**
 * Trump Policy Page
 */
export const trumpPolicyPage = sqliteTable("trump_policy_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique(),
  pageNum: integer("page_num").notNull(),
  pageContent: text("page_content").notNull(),
  r2Key: text("r2_key"),
  pageImageUrl: text("page_image_url"),
  aiSummary: text("ai_summary"),
  aiAnalysis: text("ai_analysis"),
  aiRationale: text("ai_rationale"),
  aiOrganizeTech: text("ai_organize_tech"),
  aiOrganizeFinance: text("ai_organize_finance"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Policy Scoring
 */
export const policyScoring = sqliteTable("policy_scoring", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageId: integer("page_id").notNull().references(() => trumpPolicyPage.id, { onDelete: "cascade" }),
  racialEquity: real("racial_equity"),
  economicJustice: real("economic_justice"),
  algorithmicBias: real("algorithmic_bias"),
  laborRights: real("labor_rights"),
  privacySurveillance: real("privacy_surveillance"),
  overallImpactScore: real("overall_impact_score"),
  overallRationale: text("overall_rationale"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Trump Policy Tag Type
 */
export const trumpPolicyTagType = sqliteTable("trump_policy_tag_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  parentId: integer("parent_id"), // self reference skipped for simplicity
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Trump Policy Tag
 */
export const trumpPolicyTag = sqliteTable("trump_policy_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  typeId: integer("type_id").notNull().references(() => trumpPolicyTagType.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Policy Page <-> Tag Mapping
 */
export const trumpPolicyPageTagMap = sqliteTable("trump_policy_page_tag_map", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageId: integer("page_id").notNull().references(() => trumpPolicyPage.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => trumpPolicyTag.id, { onDelete: "cascade" }),
  aiRationale: text("ai_rationale"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Policy Page <-> Guest Mapping
 */
export const trumpPolicyPageGuestMap = sqliteTable("trump_policy_page_guest_map", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageId: integer("page_id").notNull().references(() => trumpPolicyPage.id, { onDelete: "cascade" }),
  guestId: text("guest_id").notNull().references(() => guests.id, { onDelete: "cascade" }),
  aiRationale: text("ai_rationale"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Policy Page <-> Episode Mapping
 */
export const trumpPolicyPageEpisodeMap = sqliteTable("trump_policy_page_episode_map", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageId: integer("page_id").notNull().references(() => trumpPolicyPage.id, { onDelete: "cascade" }),
  episodeId: text("episode_id").notNull().references(() => episodes.id, { onDelete: "cascade" }),
  source: text("source"),
  aiRationale: text("ai_rationale"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Episode <-> Guest Mapping
 */
export const episodeGuestMap = sqliteTable("episode_guest_map", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  episodeId: text("episode_id").notNull().references(() => episodes.id, { onDelete: "cascade" }),
  guestId: text("guest_id").notNull().references(() => guests.id, { onDelete: "cascade" }),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});


/**
 * Episode Transcript Lines
 */
export const episodeTranscriptLines = sqliteTable("episode_transcript_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  episodeId: text("episode_id").notNull().references(() => episodes.id, { onDelete: "cascade" }),
  transcriptId: text("transcript_id").notNull().default(""), // Added to group transcript versions
  lineNumber: integer("line_number").notNull(),
  speakerSource: text("speaker_source").notNull(), // 'host' | 'guest'
  guestId: text("guest_id").references(() => guests.id, { onDelete: "set null" }),
  transcriptLine: text("transcript_line").notNull(),
  cue: text("cue"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Chat Trump Policy Mentions
 */
export const chatTrumpPolicyMentions = sqliteTable("chat_trump_policy_mentions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  policyPageId: integer("policy_page_id").notNull().references(() => trumpPolicyPage.id, { onDelete: "cascade" }),
  aiRationale: text("ai_rationale"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/**
 * Podcast Audio for completed episodes
 */
export const podcastAudio = sqliteTable("podcast_audio", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  episodeId: text("episode_id").notNull().references(() => episodes.id, { onDelete: "cascade" }),
  transcriptId: text("transcript_id").notNull().default(""), // Maps audio to specific transcript version
  r2Key: text("r2_key").notNull(),
  durationMs: integer("duration_ms"),
  sizeBytes: integer("size_bytes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});
