<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=maaldhis', 'root', '');
$stmt = $pdo->query("SELECT id, name FROM users WHERE name LIKE '%xasan%'");
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if ($user) {
    echo "User ID: " . $user['id'] . "\n";
    $stmt2 = $pdo->prepare("SELECT id FROM stores WHERE owner_user_id = ?");
    $stmt2->execute([$user['id']]);
    if ($stmt2->fetch()) {
        echo "User is an owner of a store!\n";
    } else {
        echo "User is NOT an owner.\n";
    }
    
    $stmt3 = $pdo->prepare("SELECT * FROM admin_roles WHERE user_id = ? AND is_active = 1");
    $stmt3->execute([$user['id']]);
    if ($stmt3->fetch()) {
        echo "User is an admin!\n";
    } else {
        echo "User is NOT an admin.\n";
    }
}
