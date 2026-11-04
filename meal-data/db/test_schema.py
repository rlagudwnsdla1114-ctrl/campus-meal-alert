"""SQLite 스키마 및 핵심 제약 검증. python meal-data/db/test_schema.py"""
import sqlite3, unittest
from pathlib import Path
class SchemaTest(unittest.TestCase):
 def setUp(self):
  self.db = sqlite3.connect(':memory:')
  self.db.executescript(Path(__file__).with_name('schema.sql').read_text())
  self.db.executescript("""
   INSERT INTO users(id,nickname) VALUES ('u1','영웅'),('u2','서원');
   INSERT INTO cafeterias VALUES ('c1','식당A');
   INSERT INTO foods(id,name,normalized_name,category) VALUES ('f1','제육볶음','제육볶음','main');
   INSERT INTO meals(id,cafeteria_id,date,meal_type) VALUES ('m1','c1','2026-11-04','lunch');
   INSERT INTO meal_items VALUES ('i1','m1','f1','제 육 볶 음',0,NULL);
  """)
 def tearDown(self): self.db.close()
 def test_independent_preferences(self):
  self.db.execute("INSERT INTO user_food_preferences(user_id,food_id,preference) VALUES ('u1','f1','liked')")
  self.db.execute("INSERT INTO user_food_preferences(user_id,food_id,preference) VALUES ('u2','f1','disliked')")
  self.assertEqual(self.db.execute('SELECT preference FROM user_food_preferences ORDER BY user_id').fetchall(), [('liked',),('disliked',)])
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO user_food_preferences(user_id,food_id,preference) VALUES ('u1','f1','disliked')")
 def test_meal_unique_and_food_survives(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO meals(id,cafeteria_id,date,meal_type) VALUES ('m2','c1','2026-11-04','lunch')")
  self.db.execute("DELETE FROM meals WHERE id='m1'")
  self.assertEqual(self.db.execute('SELECT count(*) FROM meal_items').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT count(*) FROM foods').fetchone()[0],1)
 def test_foreign_key_and_login_unique(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO user_food_preferences(user_id,food_id,preference) VALUES ('no-user','f1','liked')")
  self.db.execute("INSERT INTO auth_accounts VALUES ('a1','u1','google','subject1')")
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO auth_accounts VALUES ('a2','u2','google','subject1')")
 def test_schema_repeat_and_import_rollback(self):
  self.db.executescript(Path(__file__).with_name('schema.sql').read_text())
  self.assertEqual(self.db.execute('SELECT count(*) FROM schema_versions').fetchone()[0],1)
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:
    self.db.execute("INSERT INTO meals(id,cafeteria_id,date,meal_type) VALUES ('m2','c1','2026-11-05','lunch')")
    self.db.execute("INSERT INTO meal_items VALUES ('bad','m2','missing','不明',0,NULL)")
  self.assertEqual(self.db.execute("SELECT count(*) FROM meals WHERE id='m2'").fetchone()[0],0)
if __name__ == '__main__': unittest.main(verbosity=2)
