<?php
require_once __DIR__ . '/config.php';
requireAuth();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        $search = $_GET['search'] ?? '';
        $category = $_GET['category'] ?? '';

        $sql = "SELECT * FROM books WHERE 1=1";
        $params = [];

        if (!empty($search)) {
            $sql .= " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)";
            $s = "%{$search}%";
            $params = array_merge($params, [$s, $s, $s]);
        }
        if (!empty($category)) {
            $sql .= " AND category = ?";
            $params[] = $category;
        }

        $sql .= " ORDER BY created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
        break;

    case 'get':
        $id = $_GET['id'] ?? 0;
        $stmt = $db->prepare("SELECT * FROM books WHERE id = ?");
        $stmt->execute([$id]);
        $book = $stmt->fetch();
        if (!$book) {
            jsonResponse(['error' => 'Kitap bulunamadı'], 404);
        }
        jsonResponse($book);
        break;

    case 'categories':
        $stmt = $db->query("SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != '' ORDER BY category");
        $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);
        jsonResponse($categories);
        break;

    case 'add':
        requireRole(['admin', 'librarian', 'tester']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);

        $required = ['title', 'author'];
        foreach ($required as $field) {
            if (empty($input[$field])) {
                jsonResponse(['error' => "$field alanı zorunludur"], 400);
            }
        }

        $qty = intval($input['quantity'] ?? 1);
        $stmt = $db->prepare("INSERT INTO books (title, author, isbn, publisher, year, category, quantity, available, cover_image) VALUES (?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $input['title'],
            $input['author'],
            $input['isbn'] ?? null,
            $input['publisher'] ?? null,
            $input['year'] ?? null,
            $input['category'] ?? null,
            $qty,
            $qty,
            $input['cover_image'] ?? null
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
            jsonResponse(['error' => 'Kitap ID gerekli'], 400);
        }

        // Get current book to calculate available adjustment
        $stmt = $db->prepare("SELECT quantity, available FROM books WHERE id = ?");
        $stmt->execute([$id]);
        $current = $stmt->fetch();
        if (!$current) {
            jsonResponse(['error' => 'Kitap bulunamadı'], 404);
        }

        $newQty = intval($input['quantity'] ?? $current['quantity']);
        $borrowed = $current['quantity'] - $current['available'];
        $newAvailable = max(0, $newQty - $borrowed);

        $stmt = $db->prepare("UPDATE books SET title=?, author=?, isbn=?, publisher=?, year=?, category=?, quantity=?, available=?, cover_image=? WHERE id=?");
        $stmt->execute([
            $input['title'] ?? '',
            $input['author'] ?? '',
            $input['isbn'] ?? null,
            $input['publisher'] ?? null,
            $input['year'] ?? null,
            $input['category'] ?? null,
            $newQty,
            $newAvailable,
            $input['cover_image'] ?? null,
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

        // Check if book has active borrows
        $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM borrows WHERE book_id = ? AND status = 'borrowed'");
        $stmt->execute([$id]);
        if ($stmt->fetch()['cnt'] > 0) {
            jsonResponse(['error' => 'Bu kitabın aktif ödünç kayıtları var, silinemez'], 400);
        }

        $stmt = $db->prepare("DELETE FROM books WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Geçersiz işlem'], 400);
}
