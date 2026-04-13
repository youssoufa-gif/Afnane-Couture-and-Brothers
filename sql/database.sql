-- ================================================================
-- AFNANE COUTURE & BROTHERS — Base de Données MySQL (XAMPP)
-- ================================================================
-- Import : PhpMyAdmin > Importer > Choisir ce fichier > Exécuter
-- ================================================================

CREATE DATABASE IF NOT EXISTS afnane_couture
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE afnane_couture;

-- ----------------------------------------------------------------
-- TABLE : tasks (commandes)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    client     VARCHAR(255)    NOT NULL,
    phone      VARCHAR(50)     DEFAULT '',
    type       VARCHAR(150)    DEFAULT '',
    price      DECIMAL(12, 2)  DEFAULT 0,
    dueDate    DATE            NULL,
    step       ENUM('agenda','atelier','boutique') DEFAULT 'agenda',
    assignee   VARCHAR(150)    DEFAULT '',
    notes      TEXT,
    photo      LONGTEXT,
    createdAt  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updatedAt  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------
-- TABLE : measurements (mesures liées à une commande)
-- UNIQUE sur task_id pour permettre REPLACE INTO (upsert)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS measurements (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    task_id   INT         NOT NULL UNIQUE,
    cou       VARCHAR(20) DEFAULT '',
    epaule    VARCHAR(20) DEFAULT '',
    poitrine  VARCHAR(20) DEFAULT '',
    taille    VARCHAR(20) DEFAULT '',
    bassin    VARCHAR(20) DEFAULT '',
    bras      VARCHAR(20) DEFAULT '',
    poignet   VARCHAR(20) DEFAULT '',
    longueur  VARCHAR(20) DEFAULT '',
    pantalon  VARCHAR(20) DEFAULT '',
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------
-- TABLE : tailors (tailleurs et administrateurs)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tailors (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    username  VARCHAR(100) NOT NULL UNIQUE,
    password  VARCHAR(255) NOT NULL,
    role      ENUM('admin','tailleur') DEFAULT 'tailleur',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------
-- Compte administrateur par défaut
-- Identifiants : admin / admin123
-- (password = SHA-256 de "admin123")
-- ----------------------------------------------------------------
INSERT IGNORE INTO tailors (username, password, role)
VALUES (
    'admin',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    'admin'
);

-- ----------------------------------------------------------------
-- Exemple de tailleur (optionnel, supprimer si non nécessaire)
-- Identifiants : Moussa / tailleur123
-- ----------------------------------------------------------------
INSERT IGNORE INTO tailors (username, password, role)
VALUES (
    'Moussa',
    '6fa96e7a32f7087b41d9e3a20a7a57428e5ee6b4e2f6a3e17c4920a33823c4c5',
    'tailleur'
);
