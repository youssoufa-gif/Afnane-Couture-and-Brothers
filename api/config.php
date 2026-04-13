<?php
/**
 * AFNANE COUTURE — CONFIGURATION DE LA BASE DE DONNÉES (XAMPP)
 */

$host = '127.0.0.1';
$db   = 'afnane_couture';
$user = 'root';
$pass = ''; // Par défaut vide sur XAMPP
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     header('Content-Type: application/json');
     echo json_encode([
         'success' => false,
         'error' => 'Impossible de se connecter à MySQL : ' . $e->getMessage()
     ]);
     exit;
}
?>
