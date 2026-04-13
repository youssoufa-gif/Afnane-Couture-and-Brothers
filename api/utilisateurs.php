<?php
/**
 * AFNANE COUTURE — API PHP / MYSQL (TAILLEURS)
 */
require_once 'config.php';

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];

// GET — Liste tous les tailleurs
if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, login AS username, role FROM utilisateurs ORDER BY login ASC");
    echo json_encode($stmt->fetchAll());
}

// POST — Ajouter un tailleur
else if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || empty($data['username'])) {
        echo json_encode(['success' => false, 'error' => 'Nom manquant']);
        exit;
    }
    $username = trim($data['username']);
    $password = $data['password'] ?? hash('sha256', 'tailleur123'); // Mot de passe par défaut
    $role     = $data['role'] ?? 'tailleur';

    try {
        $stmt = $pdo->prepare("INSERT INTO utilisateurs (login, mot_de_passe, role) VALUES (?, ?, ?)");
        $stmt->execute([$username, $password, $role]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    } catch (\PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Nom déjà utilisé ou erreur DB']);
    }
}

// DELETE — Supprimer un tailleur
else if ($method === 'DELETE') {
    if (!isset($_GET['id'])) {
        echo json_encode(['success' => false, 'error' => 'ID manquant']);
        exit;
    }
    $stmt = $pdo->prepare("DELETE FROM utilisateurs WHERE id = ? AND role != 'admin'");
    $stmt->execute([$_GET['id']]);
    echo json_encode(['success' => true]);
}
?>
