<?php
/**
 * AFNANE COUTURE — API PHP / MYSQL (STRUCTURE RELATIONNELLE UML)
 */
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$method = $_SERVER['REQUEST_METHOD'];

// ----------------------------------------------------------------
// GET — Lecture (avec Jointures Clients & Mesures)
// ----------------------------------------------------------------
if ($method === 'GET') {
    try {
        if (isset($_GET['id']) && is_numeric($_GET['id'])) {
            $stmt = $pdo->prepare("
                SELECT t.idCommande, t.idClient, t.date, t.statut, t.type_vetement, t.prix, t.date_livraison, t.assigne_a, t.notes, t.photo,
                       c.nom AS client, c.telephone AS phone,
                       m.idMesureCouture, m.type_de_couture, m.longueur_epaule, m.longueur_manche, m.taille_chemise, 
                       m.poitrine, m.tour_cou, m.ceinture, m.cuisse, m.longueur_pantalon, m.cheville
                FROM commandes t
                LEFT JOIN clients c ON t.idClient = c.idClient
                LEFT JOIN mesures_couture m ON t.idCommande = m.idCommande
                WHERE t.idCommande = ?
            ");
            $stmt->execute([(int)$_GET['id']]);
            $task = $stmt->fetch();

            if ($task) {
                // Compatibilité avec l'ancien moteur JS (champs à plat et measures objet)
                $task['id'] = $task['idCommande'];
                $task['dueDate'] = $task['date_livraison'];
                $task['step'] = $task['statut'];
                $task['createdAt'] = $task['date'];
                
                $task['measures'] = [
                    'cou'      => $task['tour_cou']      ?? '',
                    'epaule'   => $task['longueur_epaule'] ?? '',
                    'poitrine' => $task['poitrine'] ?? '',
                    'taille'   => $task['taille_chemise']   ?? '',
                    'bassin'   => $task['ceinture']   ?? '',
                    'bras'     => $task['longueur_manche']     ?? '',
                    'poignet'  => $task['longueur_manche']  ?? '', // Aliasing fallback
                    'longueur' => $task['longueur_pantalon'] ?? '',
                    'pantalon' => $task['longueur_pantalon'] ?? '',
                ];
                echo json_encode($task);
            } else {
                echo json_encode(['error' => 'Commande introuvable']);
            }
        } else {
            $stmt = $pdo->query("
                SELECT t.idCommande AS id, c.nom AS client, c.telephone AS phone, t.type_vetement AS type, 
                       t.prix AS price, t.date_livraison AS dueDate, t.statut AS step, 
                       t.assigne_a AS assignee, t.notes, t.photo, t.date AS createdAt,
                       m.tour_cou AS cou, m.longueur_epaule AS epaule, m.poitrine
                FROM commandes t
                LEFT JOIN clients c ON t.idClient = c.idClient
                LEFT JOIN mesures_couture m ON t.idCommande = m.idCommande
                ORDER BY t.date DESC
            ");
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

    if (!$data || (empty($data['client']) && empty($data['idClient']))) {
        echo json_encode(['success' => false, 'error' => 'Client manquant.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // 1. Gestion du Client (Trouver ou Créer)
        $idClient = $data['idClient'] ?? null;
        if (!$idClient) {
            $nom = trim($data['client']);
            $tel = trim($data['phone'] ?? '');
            $stmtC = $pdo->prepare("SELECT idClient FROM clients WHERE nom = ? AND telephone = ?");
            $stmtC->execute([$nom, $tel]);
            $existingC = $stmtC->fetch();
            if ($existingC) {
                $idClient = $existingC['idClient'];
            } else {
                $stmtInsC = $pdo->prepare("INSERT INTO clients (nom, telephone) VALUES (?, ?)");
                $stmtInsC->execute([$nom, $tel]);
                $idClient = $pdo->lastInsertId();
            }
        }

        // 2. Commande
        $idCommande = $data['id'] ?? null;
        $params = [
            $idClient,
            $data['type'] ?? '',
            floatval($data['price'] ?? 0),
            $data['dueDate'] ?? null,
            $data['step'] ?? 'agenda',
            $data['assignee'] ?? '',
            $data['notes'] ?? '',
            $data['photo'] ?? null
        ];

        if ($idCommande) {
            $stmt = $pdo->prepare("
                UPDATE commandes 
                SET idClient=?, type_vetement=?, prix=?, date_livraison=?, statut=?, assigne_a=?, notes=?, photo=?
                WHERE idCommande=?
            ");
            $params[] = $idCommande;
            $stmt->execute($params);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO commandes (idClient, type_vetement, prix, date_livraison, statut, assigne_a, notes, photo, date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute($params);
            $idCommande = $pdo->lastInsertId();
            
            // Initialisation d'un paiement
            if (floatval($data['price'] ?? 0) > 0) {
                $stmtP = $pdo->prepare("INSERT INTO paiements (idCommande, idClient, montant, reste) VALUES (?, ?, ?, 0)");
                $stmtP->execute([$idCommande, $idClient, floatval($data['price'])]);
            }
        }

        // 3. Mesures Couture
        $m = $data['measures'] ?? [];
        $stmtM = $pdo->prepare("
            REPLACE INTO mesures_couture 
            (idCommande, tour_cou, longueur_epaule, poitrine, taille_chemise, ceinture, longueur_manche, cuisse, longueur_pantalon, cheville)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmtM->execute([
            $idCommande,
            $m['cou'] ?? 0, $m['epaule'] ?? 0, $m['poitrine'] ?? 0, $m['taille'] ?? 0,
            $m['bassin'] ?? 0, $m['bras'] ?? 0, $m['cuisse'] ?? 0, $m['longueur'] ?? 0, $m['cheville'] ?? 0
        ]);

        $pdo->commit();
        echo json_encode(['success' => true, 'id' => $idCommande]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

// ----------------------------------------------------------------
// DELETE — Suppression (Cascade SQL gère le reste)
// ----------------------------------------------------------------
else if ($method === 'DELETE') {
    if (!isset($_GET['id'])) {
        echo json_encode(['success' => false, 'error' => 'ID manquant.']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM commandes WHERE idCommande = ?");
        $stmt->execute([(int)$_GET['id']]);
        echo json_encode(['success' => true]);
    } catch (\PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>
