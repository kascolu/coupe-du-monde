-- ============================================================
-- SCHÉMA SUPABASE — Coupe du Monde 2026
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- Table des scores de la phase de groupes
CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,       -- ex: "m1", "m2"
  team_a      TEXT NOT NULL,
  team_b      TEXT NOT NULL,
  score_a     INTEGER,
  score_b     INTEGER,
  status      TEXT DEFAULT 'upcoming', -- upcoming | live | finished
  minute      INTEGER,
  group_id    TEXT,                   -- A, B, C...
  match_date  TEXT,
  gmt_time    TEXT,
  venue       TEXT,
  city        TEXT,
  auto_synced BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Table des scores des phases finales
CREATE TABLE IF NOT EXISTS knockout_matches (
  id          TEXT PRIMARY KEY,       -- ex: "k1", "k32"
  note        TEXT,                   -- ex: "M73", "QF1", "FINALE"
  round       TEXT,                   -- r32, r16, qf, sf, final
  team_a      TEXT,
  team_b      TEXT,
  score_a     INTEGER,
  score_b     INTEGER,
  status      TEXT DEFAULT 'upcoming',
  match_date  TEXT,
  gmt_time    TEXT,
  city        TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Table de log des syncs API (pour le suivi)
CREATE TABLE IF NOT EXISTS sync_log (
  id          BIGSERIAL PRIMARY KEY,
  provider    TEXT,
  matches_updated INTEGER DEFAULT 0,
  status      TEXT,                   -- ok | error
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Activer le temps réel sur les deux tables principales
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE knockout_matches;

-- Index pour accélérer les lectures par statut
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_group  ON matches(group_id);

-- Trigger : mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_matches_updated
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_knockout_updated
  BEFORE UPDATE ON knockout_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED : insérer les 72 matchs de base (statut upcoming)
-- ============================================================
INSERT INTO matches (id, team_a, team_b, group_id, match_date, gmt_time, venue, city) VALUES
('m1','Mexique','Afrique du Sud','A','2026-06-11','19:00','Estadio Azteca','Mexico City'),
('m2','Corée du Sud','Tchéquie','A','2026-06-12','02:00','Estadio Akron','Guadalajara'),
('m3','Canada','Bosnie-Herzégovine','B','2026-06-12','19:00','BMO Field','Toronto'),
('m4','États-Unis','Paraguay','D','2026-06-13','01:00','SoFi Stadium','Los Angeles'),
('m5','Qatar','Suisse','B','2026-06-13','19:00','Levi''s Stadium','San Francisco'),
('m6','Brésil','Maroc','C','2026-06-13','22:00','MetLife Stadium','New York/NJ'),
('m7','Haïti','Écosse','C','2026-06-14','01:00','Gillette Stadium','Boston'),
('m8','Australie','Turquie','D','2026-06-14','04:00','BC Place','Vancouver'),
('m9','Allemagne','Curaçao','E','2026-06-14','17:00','NRG Stadium','Houston'),
('m10','Pays-Bas','Japon','F','2026-06-14','20:00','AT&T Stadium','Dallas'),
('m11','Côte d''Ivoire','Équateur','E','2026-06-14','23:00','Lincoln Financial Field','Philadelphia'),
('m12','Suède','Tunisie','F','2026-06-15','02:00','Estadio BBVA','Monterrey'),
('m13','Espagne','Cap-Vert','H','2026-06-15','16:00','Mercedes-Benz Stadium','Atlanta'),
('m14','Belgique','Égypte','G','2026-06-15','19:00','Lumen Field','Seattle'),
('m15','Arabie saoudite','Uruguay','H','2026-06-15','22:00','Hard Rock Stadium','Miami'),
('m16','Iran','Nouvelle-Zélande','G','2026-06-16','01:00','SoFi Stadium','Los Angeles'),
('m17','France','Sénégal','I','2026-06-16','19:00','MetLife Stadium','New York/NJ'),
('m18','Irak','Norvège','I','2026-06-16','22:00','Gillette Stadium','Boston'),
('m19','Argentine','Algérie','J','2026-06-17','01:00','Arrowhead Stadium','Kansas City'),
('m20','Autriche','Jordanie','J','2026-06-17','04:00','Levi''s Stadium','San Francisco'),
('m21','Portugal','RD Congo','K','2026-06-17','17:00','NRG Stadium','Houston'),
('m22','Angleterre','Croatie','L','2026-06-17','20:00','AT&T Stadium','Dallas'),
('m23','Ghana','Panama','L','2026-06-17','23:00','BMO Field','Toronto'),
('m24','Ouzbékistan','Colombie','K','2026-06-18','02:00','Estadio Azteca','Mexico City'),
('m25','Tchéquie','Afrique du Sud','A','2026-06-18','16:00','Mercedes-Benz Stadium','Atlanta'),
('m26','Suisse','Bosnie-Herzégovine','B','2026-06-18','19:00','SoFi Stadium','Los Angeles'),
('m27','Canada','Qatar','B','2026-06-18','22:00','BC Place','Vancouver'),
('m28','Mexique','Corée du Sud','A','2026-06-19','01:00','Estadio Akron','Guadalajara'),
('m29','États-Unis','Australie','D','2026-06-19','19:00','Lumen Field','Seattle'),
('m30','Écosse','Maroc','C','2026-06-19','22:00','Gillette Stadium','Boston'),
('m31','Brésil','Haïti','C','2026-06-20','00:30','Lincoln Financial Field','Philadelphia'),
('m32','Turquie','Paraguay','D','2026-06-20','03:00','Levi''s Stadium','San Francisco'),
('m33','Pays-Bas','Suède','F','2026-06-20','17:00','NRG Stadium','Houston'),
('m34','Allemagne','Côte d''Ivoire','E','2026-06-20','20:00','BMO Field','Toronto'),
('m35','Équateur','Curaçao','E','2026-06-21','03:00','Arrowhead Stadium','Kansas City'),
('m36','Tunisie','Japon','F','2026-06-21','04:00','Estadio BBVA','Monterrey'),
('m37','Espagne','Arabie saoudite','H','2026-06-21','16:00','Mercedes-Benz Stadium','Atlanta'),
('m38','Belgique','Iran','G','2026-06-21','19:00','SoFi Stadium','Los Angeles'),
('m39','Uruguay','Cap-Vert','H','2026-06-21','22:00','Hard Rock Stadium','Miami'),
('m40','Nouvelle-Zélande','Égypte','G','2026-06-22','01:00','BC Place','Vancouver'),
('m41','Argentine','Autriche','J','2026-06-22','17:00','AT&T Stadium','Dallas'),
('m42','France','Irak','I','2026-06-22','21:00','Lincoln Financial Field','Philadelphia'),
('m43','Norvège','Sénégal','I','2026-06-23','00:00','MetLife Stadium','New York/NJ'),
('m44','Jordanie','Algérie','J','2026-06-23','03:00','Levi''s Stadium','San Francisco'),
('m45','Portugal','Ouzbékistan','K','2026-06-23','17:00','NRG Stadium','Houston'),
('m46','Angleterre','Ghana','L','2026-06-23','20:00','Gillette Stadium','Boston'),
('m47','Panama','Croatie','L','2026-06-23','23:00','BMO Field','Toronto'),
('m48','Colombie','RD Congo','K','2026-06-24','02:00','Estadio Akron','Guadalajara'),
('m49','Suisse','Canada','B','2026-06-24','19:00','BC Place','Vancouver'),
('m50','Bosnie-Herzégovine','Qatar','B','2026-06-24','19:00','Lumen Field','Seattle'),
('m51','Écosse','Brésil','C','2026-06-24','22:00','Hard Rock Stadium','Miami'),
('m52','Maroc','Haïti','C','2026-06-24','22:00','Mercedes-Benz Stadium','Atlanta'),
('m53','Tchéquie','Mexique','A','2026-06-25','01:00','Estadio Azteca','Mexico City'),
('m54','Afrique du Sud','Corée du Sud','A','2026-06-25','01:00','Estadio BBVA','Monterrey'),
('m55','Équateur','Allemagne','E','2026-06-25','20:00','MetLife Stadium','New York/NJ'),
('m56','Curaçao','Côte d''Ivoire','E','2026-06-25','20:00','Lincoln Financial Field','Philadelphia'),
('m57','Japon','Suède','F','2026-06-25','23:00','AT&T Stadium','Dallas'),
('m58','Tunisie','Pays-Bas','F','2026-06-25','23:00','Arrowhead Stadium','Kansas City'),
('m59','Turquie','États-Unis','D','2026-06-26','02:00','SoFi Stadium','Los Angeles'),
('m60','Paraguay','Australie','D','2026-06-26','02:00','Levi''s Stadium','San Francisco'),
('m61','Norvège','France','I','2026-06-26','19:00','Gillette Stadium','Boston'),
('m62','Sénégal','Irak','I','2026-06-26','19:00','BMO Field','Toronto'),
('m63','Cap-Vert','Arabie saoudite','H','2026-06-27','00:00','NRG Stadium','Houston'),
('m64','Uruguay','Espagne','H','2026-06-27','00:00','Estadio Akron','Guadalajara'),
('m65','Égypte','Iran','G','2026-06-27','03:00','Lumen Field','Seattle'),
('m66','Nouvelle-Zélande','Belgique','G','2026-06-27','03:00','BC Place','Vancouver'),
('m67','Panama','Angleterre','L','2026-06-27','21:00','MetLife Stadium','New York/NJ'),
('m68','Croatie','Ghana','L','2026-06-27','21:00','Lincoln Financial Field','Philadelphia'),
('m69','Colombie','Portugal','K','2026-06-27','23:30','Hard Rock Stadium','Miami'),
('m70','RD Congo','Ouzbékistan','K','2026-06-27','23:30','Mercedes-Benz Stadium','Atlanta'),
('m71','Algérie','Autriche','J','2026-06-28','02:00','Arrowhead Stadium','Kansas City'),
('m72','Jordanie','Argentine','J','2026-06-28','02:00','AT&T Stadium','Dallas')
ON CONFLICT (id) DO NOTHING;
