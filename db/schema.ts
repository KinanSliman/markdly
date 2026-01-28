import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

// Document metadata interface for typed JSON columns
export interface DocumentMetadata {
  commitSha?: string;
  prUrl?: string;
  [key: string]: unknown;
}

// Users table (for Auth.js / NextAuth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified"),
  image: text("image"),
  avatar: text("avatar"),
  // Email/password auth fields
  passwordHash: text("password_hash"), // Only for email/password signups
  signupSource: text("signup_source").default("email"), // 'email', 'github', 'google'
  signupDate: timestamp("signup_date").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sessions table (for Auth.js / NextAuth)
export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expires: timestamp("expires").notNull(),
});

// Accounts table (for Auth.js / NextAuth - OAuth providers)
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"), // NextAuth stores this as Unix timestamp (number)
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

// Verification Tokens (for Auth.js / NextAuth)
export const verificationTokens = pgTable("verificationTokens", {
  identifier: text("identifier").notNull(),
  token: text("token").unique().notNull(),
  expires: timestamp("expires").notNull(),
});

// Workspaces (teams)
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").references(() => users.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// GitHub Connections
export const githubConnections = pgTable("github_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  repoOwner: text("repo_owner"),
  repoName: text("repo_name"),
  installationId: text("installation_id"),
  accessToken: text("access_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Google Connections
export const googleConnections = pgTable("google_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  folderId: text("folder_id"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sync Configurations
export const syncConfigs = pgTable("sync_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  githubConnectionId: uuid("github_connection_id").references(() => githubConnections.id),
  googleConnectionId: uuid("google_connection_id").references(() => googleConnections.id),
  name: text("name"),
  mode: text("mode").default("github"), // 'github' (sync to repo) or 'convert-only' (download only)
  framework: text("framework"), // 'nextjs', 'hugo', 'docusaurus', etc.
  outputPath: text("output_path"), // e.g., 'content/posts/'
  frontmatterTemplate: text("frontmatter_template"), // YAML template
  imageStrategy: text("image_strategy"), // 'github', 'cloudinary', 'r2'
  imagePath: text("image_path"), // e.g., 'public/images/'
  isActive: boolean("is_active").default(true),
  syncSchedule: text("sync_schedule"), // 'manual', 'hourly', 'daily'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sync History
export const syncHistory = pgTable("sync_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  syncConfigId: uuid("sync_config_id").references(() => syncConfigs.id),
  docId: text("doc_id"),
  docTitle: text("doc_title"),
  status: text("status"), // 'pending', 'success', 'failed'
  errorMessage: text("error_message"),
  filesChanged: text("files_changed"),
  commitSha: text("commit_sha"),
  filePath: text("file_path"), // Path to the file in GitHub repo
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// Documents (tracked docs)
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  syncConfigId: uuid("sync_config_id").references(() => syncConfigs.id),
  googleDocId: text("google_doc_id").unique(),
  title: text("title"),
  lastSynced: timestamp("last_synced"),
  lastModified: timestamp("last_modified"),
  metadata: jsonb("metadata").$type<DocumentMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// API Keys (for API access)
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  keyHash: text("key_hash"),
  name: text("name"),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: uuid("user_id").references(() => users.id),
  action: text("action"),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Analytics (user event tracking)
export const analytics = pgTable("analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  event: text("event").notNull(), // 'signup', 'oauth_connect', 'sync', 'sync_success', 'sync_failed'
  metadata: jsonb("metadata"), // Event-specific data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Performance Metrics (tracking conversion, sync, API performance)
export const performanceMetrics = pgTable("performance_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  operationType: text("operation_type").notNull(), // 'conversion', 'sync', 'api'
  operationId: text("operation_id"), // Unique identifier for the operation
  duration: integer("duration").notNull(), // Duration in milliseconds
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  metrics: jsonb("metrics"), // Detailed metrics (conversion, sync, or API metrics)
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Performance Alerts (performance degradation alerts)
export const performanceAlerts = pgTable("performance_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertType: text("alert_type").notNull(), // 'slow_conversion', 'high_error_rate', 'low_cache_hit_rate', etc.
  severity: text("severity").notNull(), // 'info', 'warning', 'critical'
  message: text("message").notNull(),
  details: jsonb("details"), // Alert-specific details
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
});
