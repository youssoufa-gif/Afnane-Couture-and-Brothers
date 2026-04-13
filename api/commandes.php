<?php
/**
 * AFNANE COUTURE — API PHP / MYSQL (GESTION DES COMMANDES)
 * Compatible avec le schéma database.sql (tasks & measurements)
 */
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$method = $_SERVER['REQUEST_METHOD'];

// ----------------------------------------------------------------
// GET — Lecture des commandes
// ----------------------------------------------------------------
if ($method === 'GET') {
    try {
        if (isset($_GET['id']) && is_numeric($_GET['id'])) {
            // Lecture d'une seule commande avec ses mesures
            $stmt = $pdo->prepare("
                SELECT t.*, m.cou, m.epaule, m.poitrine, m.taille, m.bassin, m.bras, m.poignet, m.longueur, m.pantalon
                FROM tasks t
                LEFT JOIN measurements m ON t.id = m.task_id
                WHERE t.id = ?
            ");
            $stmt->execute([(int)$_GET['id']]);
            $task = $stmt->fetch();

            if ($task) {
                // Structure pour le frontend (objets imbriqués)
                $task['measures'] = [
                    'cou'      => $task['cou']      ?? '',
                    'epaule'   => $task['epaule']   ?? '',
                    'poitrine' => $task['poitrine'] ?? '',
                    'taille'   => $task['taille']   ?? '',
                    'bassin'   => $task['bassin']   ?? '',
                    'bras'     => $task['bras']     ?? '',
                    'poignet'  => $task['poignet']  ?? '',
                    'longueur' => $task['longueur'] ?? '',
                    'pantalon' => $task['pantalon'] ?? ''
                ];
                echo json_encode($task);
            } else {
                echo json_encode(['error' => 'Commande introuvable']);
            }
        } else {
            // Liste toutes les commandes (version simplifiée pour le dashboard)
            $stmt = $pdo->query("SELECT * FROM tasks ORDER BY createdAt DESC");
            echo json_encode($stmt->fetchAll());
        }
    } catch (\PDOException $e) {
        echo json_encode(['error' => 'DB Error: ' . $e->getMessage()]);
    }
}

// ----------------------------------------------------------------
// POST — Création ou mise à jour
// ----------------------------------------------------------------
else if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data || empty($data['client'])) {
        echo json_encode(['success' => false, 'error' => 'Client manquant.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $id = $data['id'] ?? null;
        $params = [
            $data['client'],
            $data['phone']    ?? '',
            $data['type']     ?? '',
            floatval($data['price'] ?? 0),
            $data['dueDate']  ?? null,
            $data['step']     ?? 'agenda',
            $data['assignee'] ?? '',
            $data['notes']    ?? '',
            $data['photo']    ?? null
        ];

        if ($id && is_numeric($id)) {
            // Update
            $stmt = $pdo->prepare("
                UPDATE tasks 
                SET client=?, phone=?, type=?, price=?, dueDate=?, step=?, assignee=?, notes=?, photo=?
                WHERE id=?
            ");
            $params[] = $id;
            $stmt->execute($params);
        } else {
            // Insert
            $stmt = $pdo->prepare("
                INSERT INTO tasks (client, phone, type, price, dueDate, step, assignee, notes, photo, createdAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute($params);
            $id = $pdo->lastInsertId();
        }

        // Gestion des mesures
        if (isset($data['measures'])) {
            $m = $data['measures'];
            $stmtM = $pdo->prepare("
                REPLACE INTO measurements 
                (task_id, cou, epaule, poitrine, taille, bassin, bras, poignet, longueur, pantalon)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtM->execute([
                $id,
                $m['cou'] ?? '', $m['epaule'] ?? '', $m['poitrine'] ?? '', $m['taille'] ?? '',
                $m['bassin'] ?? '', $m['bras'] ?? '', $m['poignet'] ?? '', $m['longueur'] ?? '', $m['pantalon'] ?? ''
            ]);
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'id' => $id]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

// ----------------------------------------------------------------
// DELETE — Suppression
// ----------------------------------------------------------------
else if ($method === 'DELETE') {
    if (!isset($_GET['id'])) {
        echo json_encode(['success' => false, 'error' => 'ID manquant.']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = ?");
        $stmt->execute([(int)$_GET['id']]);
        echo json_encode(['success' => true]);
    } catch (\PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>
