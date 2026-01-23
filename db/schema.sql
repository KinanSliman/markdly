-- Markdly Database Schema
-- PostgreSQL schema for direct import
-- Run this in your PostgreSQL database to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspaces (teams)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Connections
CREATE TABLE github_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    repo_owner TEXT,
    repo_name TEXT,
    installation_id TEXT,
    access_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google Connections
CREATE TABLE google_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync Configurations
CREATE TABLE sync_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    github_connection_id UUID REFERENCES github_connections(id) ON DELETE SET NULL,
    google_connection_id UUID REFERENCES google_connections(id) ON DELETE SET NULL,
    name TEXT,
    framework TEXT, -- 'nextjs', 'hugo', 'docusaurus', etc.
    output_path TEXT, -- e.g., 'content/posts/'
    frontmatter_template TEXT, -- YAML template
    image_strategy TEXT, -- 'github', 'cloudinary', 'r2'
    image_path TEXT, -- e.g., 'public/images/'
    is_active BOOLEAN DEFAULT true,
    sync_schedule TEXT, -- 'manual', 'hourly', 'daily'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync History
CREATE TABLE sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_config_id UUID REFERENCES sync_configs(id) ON DELETE CASCADE,
    doc_id TEXT,
    doc_title TEXT,
    status TEXT, -- 'pending', 'success', 'failed'
    error_message TEXT,
    files_changed INTEGER,
    commit_sha TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Documents (tracked docs)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_config_id UUID REFERENCES sync_configs(id) ON DELETE CASCADE,
    google_doc_id TEXT UNIQUE,
    title TEXT,
    last_synced TIMESTAMP WITH TIME ZONE,
    last_modified TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys (for API access)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    key_hash TEXT,
    name TEXT,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_github_connections_workspace_id ON github_connections(workspace_id);
CREATE INDEX idx_google_connections_workspace_id ON google_connections(workspace_id);
CREATE INDEX idx_sync_configs_workspace_id ON sync_configs(workspace_id);
CREATE INDEX idx_sync_history_sync_config_id ON sync_history(sync_config_id);
CREATE INDEX idx_sync_history_status ON sync_history(status);
CREATE INDEX idx_documents_sync_config_id ON documents(sync_config_id);
CREATE INDEX idx_documents_google_doc_id ON documents(google_doc_id);
CREATE INDEX idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Foreign key constraints (additional for data integrity)
ALTER TABLE workspaces
    ADD CONSTRAINT fk_workspaces_owner
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE github_connections
    ADD CONSTRAINT fk_github_connections_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE google_connections
    ADD CONSTRAINT fk_google_connections_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE sync_configs
    ADD CONSTRAINT fk_sync_configs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE sync_configs
    ADD CONSTRAINT fk_sync_configs_github
    FOREIGN KEY (github_connection_id) REFERENCES github_connections(id) ON DELETE SET NULL;

ALTER TABLE sync_configs
    ADD CONSTRAINT fk_sync_configs_google
    FOREIGN KEY (google_connection_id) REFERENCES google_connections(id) ON DELETE SET NULL;

ALTER TABLE sync_history
    ADD CONSTRAINT fk_sync_history_sync_config
    FOREIGN KEY (sync_config_id) REFERENCES sync_configs(id) ON DELETE CASCADE;

ALTER TABLE documents
    ADD CONSTRAINT fk_documents_sync_config
    FOREIGN KEY (sync_config_id) REFERENCES sync_configs(id) ON DELETE CASCADE;

ALTER TABLE api_keys
    ADD CONSTRAINT fk_api_keys_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Comments for documentation
COMMENT ON TABLE users IS 'Users who own workspaces and access the application';
COMMENT ON TABLE workspaces IS 'Workspaces (teams) that own sync configurations';
COMMENT ON TABLE github_connections IS 'GitHub OAuth connections for syncing to repositories';
COMMENT ON TABLE google_connections IS 'Google OAuth connections for accessing Drive/Docs';
COMMENT ON TABLE sync_configs IS 'Configurations for syncing Google Docs to GitHub';
COMMENT ON TABLE sync_history IS 'History of sync operations with status and results';
COMMENT ON TABLE documents IS 'Tracked Google Docs that have been synced';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access (Phase 4)';
COMMENT ON TABLE audit_logs IS 'Audit trail of all actions in the system';
