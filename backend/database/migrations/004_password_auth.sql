-- Optional password for local login (Google-only users have NULL until set via CLI or future flow).
ALTER TABLE users ADD COLUMN password_hash TEXT;
