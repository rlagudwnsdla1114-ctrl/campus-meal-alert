BEGIN;

ALTER TABLE user_food_preferences
ADD COLUMN reason TEXT
CHECK(reason IN ('taste_texture','allergy','other'));

ALTER TABLE user_food_preferences ADD COLUMN note TEXT;

UPDATE user_food_preferences
SET reason = 'other'
WHERE preference = 'disliked';

CREATE TABLE allergens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) > 0)
);

CREATE TABLE user_allergy_profiles (
    user_id TEXT PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_set'
        CHECK(status IN ('not_set','none_declared','registered')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_allergens (
    user_id TEXT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    allergen_id TEXT NOT NULL REFERENCES allergens(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, allergen_id)
);

CREATE TABLE preference_allergens (
    user_id TEXT NOT NULL,
    food_id TEXT NOT NULL,
    allergen_id TEXT NOT NULL REFERENCES allergens(id),
    PRIMARY KEY(user_id, food_id, allergen_id),
    FOREIGN KEY(user_id, food_id)
        REFERENCES user_food_preferences(user_id, food_id)
        ON DELETE CASCADE
);

CREATE TRIGGER preference_allergens_validate
BEFORE INSERT ON preference_allergens
WHEN NOT EXISTS (
    SELECT 1 FROM user_food_preferences
    WHERE user_id = NEW.user_id
      AND food_id = NEW.food_id
      AND preference = 'disliked'
      AND reason = 'allergy'
)
BEGIN
    SELECT RAISE(ABORT, 'Allergy reason required');
END;

CREATE TRIGGER preference_allergens_cleanup
AFTER UPDATE OF preference, reason ON user_food_preferences
WHEN NEW.preference != 'disliked'
  OR NEW.reason IS NULL
  OR NEW.reason != 'allergy'
BEGIN
    DELETE FROM preference_allergens
    WHERE user_id = NEW.user_id AND food_id = NEW.food_id;
END;

INSERT INTO user_allergy_profiles(user_id)
SELECT id FROM users;

INSERT INTO schema_versions(version) VALUES(2);

COMMIT;