<?php
/**
 * AFNANE COUTURE — API PHP / MYSQL (AUTHENTIFICATION ROBUSTE)
 */
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || empty($data['username']) || empty($data['password'])) {
    echo json_encode(['success' => false, 'error' => 'Veuillez saisir un utilisateur et un mot de passe.']);
    exit;
}

$user = trim($data['username']);
$pass = $data['password']; 

try {
    // 1. On cherche l'utilisateur dans la table tailors (cohérent avec database.sql)
    $stmt = $pdo->prepare("SELECT * FROM tailors WHERE username = ?");
    $stmt->execute([$user]);
    $userData = $stmt->fetch();

    if ($userData) {
        // 2. On vérifie le mot de passe (haché SHA-256 comme dans le SQL)
        if ($userData['password'] === $pass) {
            echo json_encode([
                'success' => true,
                'user' => [
                    'username' => $userData['username'],
                    'role' => $userData['role']
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => "Nom d'utilisateur ou mot de passe incorrect."]);
        }
    } else {
        echo json_encode(['success' => false, 'error' => "Nom d'utilisateur ou mot de passe incorrect."]);
    }

} catch (\PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Erreur MySQL : ' . $e->getMessage()]);
}
?>
