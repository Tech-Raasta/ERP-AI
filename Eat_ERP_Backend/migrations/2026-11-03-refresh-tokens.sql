-- Sign-in sessions (lib/authTokens.js). One row per refresh token; only its SHA-256 hash is stored.
-- A refresh replaces the row (revoked_on + replaced_by_hash) with a new one of the same family; using a replaced
-- token again revokes the whole family (that sign-in), as it means the token was copied.
CREATE TABLE user_refresh_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  family CHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  remember TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  session_expires_at DATETIME NOT NULL,
  created_on DATETIME NOT NULL,
  revoked_on DATETIME NULL DEFAULT NULL,
  replaced_by_hash CHAR(64) NULL DEFAULT NULL,
  user_agent VARCHAR(255) NULL,
  ip VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id),
  KEY idx_refresh_family (family)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
