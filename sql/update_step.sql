-- MISE À JOUR DU STATUT DES COMMANDES
-- À exécuter dans l'onglet SQL de phpMyAdmin si l'importation a déjà été faite
USE afnane_couture;

-- 1. Autoriser le statut 'livre' (Livré) dans la table tasks
ALTER TABLE tasks MODIFY COLUMN step ENUM('agenda', 'atelier', 'boutique', 'livre') DEFAULT 'agenda';

-- 2. Vérifier que measurements a bien la contrainte UNIQUE (nécessaire pour REPLACE INTO)
-- Si l'index n'existe pas déjà, on l'ajoute
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                     WHERE table_schema = 'afnane_couture' AND table_name = 'measurements' AND index_name = 'task_id');
SET @sql = IF(@index_exists = 0, 'ALTER TABLE measurements ADD UNIQUE (task_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
