-- Instelling voor modules die de gebruiker heeft uitgeschakeld (frontend/src/modules/registry.ts).
INSERT OR IGNORE INTO settings (key, value, value_type, description, updated_at)
VALUES ('disabled_modules', '[]', 'json', 'Module-id''s die de gebruiker heeft uitgeschakeld', unixepoch());
