PRAGMA foreign_keys = ON;
BEGIN;
CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, nickname TEXT NOT NULL CHECK(length(trim(nickname)) > 0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS auth_accounts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 provider TEXT NOT NULL CHECK(provider IN ('kakao','google','local')),
 provider_subject TEXT NOT NULL CHECK(length(trim(provider_subject)) > 0),
 UNIQUE(provider, provider_subject), UNIQUE(user_id, provider)
);
CREATE TABLE IF NOT EXISTS local_credentials (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL CHECK(length(password_hash) > 0)
);
CREATE TABLE IF NOT EXISTS cafeterias (id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) > 0));
CREATE TABLE IF NOT EXISTS foods (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) > 0),
 normalized_name TEXT NOT NULL UNIQUE CHECK(length(normalized_name) > 0),
 category TEXT NOT NULL DEFAULT 'unknown' CHECK(category IN ('staple','soup','main','side','kimchi','dessert_drink','unknown')),
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','confirmed'))
);
CREATE TABLE IF NOT EXISTS food_aliases (
 food_id TEXT NOT NULL REFERENCES foods(id), alias TEXT NOT NULL,
 normalized_alias TEXT PRIMARY KEY CHECK(length(normalized_alias) > 0)
);
CREATE TABLE IF NOT EXISTS food_tags (
 food_id TEXT NOT NULL REFERENCES foods(id),
 tag_type TEXT NOT NULL CHECK(tag_type IN ('ingredient','cooking_method')),
 tag_value TEXT NOT NULL CHECK(length(trim(tag_value)) > 0),
 PRIMARY KEY(food_id, tag_type, tag_value)
);
CREATE TABLE IF NOT EXISTS meal_sources (
 id TEXT PRIMARY KEY, cafeteria_id TEXT NOT NULL REFERENCES cafeterias(id),
 file_name TEXT NOT NULL, checksum TEXT NOT NULL,
 target_year INTEGER CHECK(target_year BETWEEN 2000 AND 2100),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','imported','failed')),
 notes TEXT, imported_at TEXT,
 UNIQUE(cafeteria_id, checksum)
);
CREATE TABLE IF NOT EXISTS meals (
 id TEXT PRIMARY KEY, cafeteria_id TEXT NOT NULL REFERENCES cafeterias(id),
 source_id TEXT REFERENCES meal_sources(id),
 date TEXT NOT NULL CHECK(length(date)=10 AND date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
 meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner')),
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','closed','unknown')),
 serving_start TEXT, serving_end TEXT,
 UNIQUE(cafeteria_id, date, meal_type)
);
CREATE TABLE IF NOT EXISTS meal_items (
 id TEXT PRIMARY KEY, meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
 food_id TEXT NOT NULL REFERENCES foods(id), raw_text TEXT NOT NULL CHECK(length(trim(raw_text))>0),
 sort_order INTEGER NOT NULL CHECK(sort_order >= 0), note TEXT,
 UNIQUE(meal_id, food_id), UNIQUE(meal_id, sort_order)
);
CREATE TABLE IF NOT EXISTS user_food_preferences (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 food_id TEXT NOT NULL REFERENCES foods(id),
 preference TEXT NOT NULL CHECK(preference IN ('liked','disliked')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id, food_id)
);
CREATE INDEX IF NOT EXISTS idx_meal_items_food ON meal_items(food_id);
INSERT OR IGNORE INTO schema_versions(version) VALUES(1);
COMMIT;
