<?php
require_once __DIR__ . '/config.php';
requireAuth();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        requireRole(['admin', 'librarian', 'tester']);
        $search = $_GET['search'] ?? '';
        $sql = "SELECT * FROM members WHERE 1=1";
        $params = [];

        if (!empty($search)) {
            $sql .= " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)";
            $s = "%{$search}%";
            $params = array_merge($params, [$s, $s, $s]);
        }

        $sql .= " ORDER BY created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
        break;

    case 'get':
        requireRole(['admin', 'librarian', 'tester']);
        $id = $_GET['id'] ?? 0;
        $stmt = $db->prepare("SELECT * FROM members WHERE id = ?");
        $stmt->execute([$id]);
        $member = $stmt->fetch();
        if (!$member) {
            jsonResponse(['error' => 'Üye bulunamadı'], 404);
        }
        jsonResponse($member);
        break;

    case 'add':
        requireRole(['admin', 'librarian', 'tester']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['full_name'])) {
            jsonResponse(['error' => 'Ad soyad alanı zorunludur'], 400);
        }

        $stmt = $db->prepare("INSERT INTO members (full_name, email, phone, address) VALUES (?,?,?,?)");
        $stmt->execute([
            $input['full_name'],
            $input['email'] ?? null,
            $input['phone'] ?? null,
            $input['address'] ?? null
        ]);
        jsonResponse(['success' => true, 'id' => $db->lastInsertId()], 201);
        break;

    case 'update':
        requireRole(['admin', 'librarian', 'tester']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? 0;

        if (empty($id)) {
            jsonResponse(['error' => 'Üye ID gerekli'], 400);
        }

        $stmt = $db->prepare("UPDATE members SET full_name=?, email=?, phone=?, address=?, status=? WHERE id=?");
        $stmt->execute([
            $input['full_name'] ?? '',
            $input['email'] ?? null,
            $input['phone'] ?? null,
            $input['address'] ?? null,
            $input['status'] ?? 'active',
            $id
        ]);
        jsonResponse(['success' => true]);
        break;

    case 'delete':
        requireRole(['admin', 'librarian', 'tester']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? 0;

        // Check active borrows
        $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM borrows WHERE member_id = ? AND status = 'borrowed'");
        $stmt->execute([$id]);
        if ($stmt->fetch()['cnt'] > 0) {
            jsonResponse(['error' => 'Bu üyenin aktif ödünç kayıtları var, silinemez'], 400);
        }

        $stmt = $db->prepare("DELETE FROM members WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Geçersiz işlem'], 400);
}
