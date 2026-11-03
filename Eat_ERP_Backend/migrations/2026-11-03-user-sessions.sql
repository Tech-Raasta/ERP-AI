-- Sign-out on the server (lib/sessions.js): tokens issued before this moment are refused.
ALTER TABLE user_master ADD COLUMN tokens_valid_from DATETIME NULL DEFAULT NULL;
