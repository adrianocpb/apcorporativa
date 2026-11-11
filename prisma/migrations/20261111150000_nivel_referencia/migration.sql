-- Nível 4 passa a se chamar "Referência" (antes "Especialista"). Só renomeia se o
-- administrador não tiver dado outro nome ao nível.
UPDATE "Level" SET "name" = 'Referência' WHERE "name" = 'Especialista';
