<?php
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($username) || empty($password)) {
            jsonResponse(['error' => 'Kullanıcı adı ve şifre gerekli'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonResponse(['error' => 'Geçersiz kullanıcı adı veya şifre'], 401);
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['full_name'] = $user['full_name'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['active_role'] = $user['role'];

        jsonResponse([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'full_name' => $user['full_name'],
                'role' => $user['role'],
                'active_role' => $user['role']
            ]
        ]);
        break;

    case 'register':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        $fullName = trim($input['full_name'] ?? '');
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');

        if (empty($username) || empty($password) || empty($fullName)) {
            jsonResponse(['error' => 'Kullanıcı adı, şifre ve ad soyad zorunludur'], 400);
        }

        if (strlen($username) < 3) {
            jsonResponse(['error' => 'Kullanıcı adı en az 3 karakter olmalı'], 400);
        }

        if (strlen($password) < 4) {
            jsonResponse(['error' => 'Şifre en az 4 karakter olmalı'], 400);
        }

        // Check if username exists
        $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Bu kullanıcı adı zaten kullanılıyor'], 400);
        }

        // Insert into users table
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, 'member')");
        $stmt->execute([$username, $hash, $fullName]);
        $userId = $db->lastInsertId();

        // Insert into members table
        $stmt = $db->prepare("INSERT INTO members (full_name, email, phone) VALUES (?, ?, ?)");
        $stmt->execute([$fullName, $email ?: null, $phone ?: null]);

        jsonResponse(['success' => true, 'message' => 'Üyelik başarıyla oluşturuldu'], 201);
        break;

    case 'logout':
        session_destroy();
        jsonResponse(['success' => true]);
        break;

    case 'check':
        if (isset($_SESSION['user_id'])) {
            jsonResponse([
                'authenticated' => true,
                'user' => [
                    'id' => $_SESSION['user_id'],
                    'username' => $_SESSION['username'],
                    'full_name' => $_SESSION['full_name'],
                    'role' => $_SESSION['role'],
                    'active_role' => $_SESSION['active_role'] ?? $_SESSION['role']
                ]
            ]);
        } else {
            jsonResponse(['authenticated' => false]);
        }
        break;

    case 'switch-role':
        requireAuth();
        if ($_SESSION['role'] !== 'tester') {
            jsonResponse(['error' => 'Sadece tester rolü rol değiştirebilir'], 403);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $newRole = $input['role'] ?? '';
        $validRoles = ['admin', 'librarian', 'member', 'tester'];
        if (!in_array($newRole, $validRoles)) {
            jsonResponse(['error' => 'Geçersiz rol'], 400);
        }
        $_SESSION['active_role'] = $newRole;
        jsonResponse([
            'success' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'full_name' => $_SESSION['full_name'],
                'role' => $_SESSION['role'],
                'active_role' => $newRole
            ]
        ]);
        break;

    default:
        jsonResponse(['error' => 'Geçersiz işlem'], 400);
}
