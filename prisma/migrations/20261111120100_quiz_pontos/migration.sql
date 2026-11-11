-- Regra de pontos do quiz para bancos que já existiam (instalações novas recebem pelo seed).
INSERT OR IGNORE INTO "PointRule" ("id", "event", "points", "active", "updatedAt")
VALUES ('regra-content-quiz', 'CONTENT_QUIZ', 15, true, CURRENT_TIMESTAMP);
