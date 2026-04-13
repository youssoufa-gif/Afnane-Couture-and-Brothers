<?php
require_once 'api/config.php';
$stmt = $pdo->prepare("SELECT * FROM tailors WHERE username = 'moussa'");
$stmt->execute();
$moussa = $stmt->fetch();
if ($moussa) {
    echo "UTILISATEUR TROUVÉ : " . $moussa['username'] . "\n";
    echo "MOT DE PASSE (HACHÉ) : " . $moussa['password'] . "\n";
} else {
    echo "Moussa n'existe pas dans la base de données.";
}
?>
