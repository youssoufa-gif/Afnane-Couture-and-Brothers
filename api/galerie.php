<?php
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Liste des produits
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare("SELECT id, titre AS title, prix AS price, categorie AS category, photo, date_creation AS created_at FROM galerie WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        echo json_encode($stmt->fetch());
    } else {
        $stmt = $pdo->query("SELECT id, titre AS title, prix AS price, categorie AS category, photo, date_creation AS created_at FROM galerie ORDER BY date_creation DESC");
        echo json_encode($stmt->fetchAll());
    }
} 
elseif ($method === 'POST') {
    // Ajouter ou Modifier un produit
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['id'])) {
        // Update
        $stmt = $pdo->prepare("UPDATE galerie SET titre = ?, prix = ?, categorie = ?, photo = ? WHERE id = ?");
        $success = $stmt->execute([$input['title'], $input['price'], $input['category'], $input['photo'], $input['id']]);
        echo json_encode(['success' => $success, 'id' => $input['id']]);
    } else {
        // Insert
        $stmt = $pdo->prepare("INSERT INTO galerie (titre, prix, categorie, photo) VALUES (?, ?, ?, ?)");
        $success = $stmt->execute([$input['title'], $input['price'], $input['category'], $input['photo']]);
        echo json_encode(['success' => $success, 'id' => $pdo->lastInsertId()]);
    }
} 
elseif ($method === 'DELETE') {
    // Supprimer un produit
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare("DELETE FROM galerie WHERE id = ?");
        $success = $stmt->execute([$_GET['id']]);
        echo json_encode(['success' => $success]);
    } else {
        echo json_encode(['success' => false, 'error' => 'ID manquant']);
    }
}
?>
