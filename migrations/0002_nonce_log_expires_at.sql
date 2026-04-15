ALTER TABLE nonce_log ADD COLUMN expires_at INTEGER;
CREATE INDEX idx_nonce_log_expires ON nonce_log(expires_at);
