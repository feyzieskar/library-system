<?php
require_once __DIR__ . '/config.php';
requireAuth();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';

        $sql = "SELECT b.*, bk.title as book_title, bk.author as book_author, m.full_name as member_name
                FROM borrows b
                JOIN books bk ON b.book_id = bk.id
                JOIN members m ON b.member_id = m.id
                WHERE 1=1";
        $params = [];

        if (!empty($status)) {
            $sql .= " AND b.status = ?";
            $params[] = $status;
        }
        if (!empty($search)) {
            $sql .= " AND (bk.title LIKE ? OR m.full_name LIKE ?)";
            $s = "%{$search}%";
            $params = array_merge($params, [$s, $s]);
        }

        $sql .= " ORDER BY b.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $borrows = $stmt->fetchAll();

        // Mark overdue items
        $today = date('Y-m-d');
        foreach ($borrows as &$borrow) {
            if ($borrow['status'] === 'borrowed' && $borrow['due_date'] < $today) {
                $borrow['status'] = 'overdue';
                // Update in DB
                $db->prepare("UPDATE borrows SET status='overdue' WHERE id=? AND status='borrowed'")->execute([$borrow['id']]);
            }
        }

        jsonResponse($borrows);
        break;

    case 'borrow':
        requireRole(['admin', 'librarian', 'tester']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $bookId = $input['book_id'] ?? 0;
        $memberId = $input['member_id'] ?? 0;
        $dueDate = $input['due_date'] ?? date('Y-m-d', strtotime('+14 days'));

        if (empty($bookId) || empty($memberId)) {
            jsonResponse(['error' => 'Kitap ve üye seçimi zorunludur'], 400);
        }

        // Check book availability
        $stmt = $db->prepare("SELECT available, title FROM books WHERE id = ?");
        $stmt->execute([$bookId]);
        $book = $stmt->fetch();
        if (!$book) {
            jsonResponse(['error' => 'Kitap bulunamadı'], 404);
        }
        if ($book['available'] <= 0) {
            jsonResponse(['error' => 'Bu kitabın stokta mevcut kopyası yok'], 400);
        }

        // Check member status
        $stmt = $db->prepare("SELECT status, full_name FROM members WHERE id = ?");
        $stmt->execute([$memberId]);
        $member = $stmt->fetch();
        if (!$member) {
            jsonResponse(['error' => 'Üye bulunamadı'], 404);
        }
        if ($member['status'] !== 'active') {
            jsonResponse(['error' => 'Pasif üyelere kitap verilemez'], 400);
        }

        // Create borrow record
        $stmt = $db->prepare("INSERT INTO borrows (book_id, member_id, borrow_date, due_date, status) VALUES (?,?,CURRENT_DATE,?,?)");
        $stmt->execute([$bookId, $memberId, $dueDate, 'borrowed']);

        // Decrease available count
        $db->prepare("UPDATE books SET available = available - 1 WHERE id = ?")->execute([$bookId]);

        jsonResponse(['success' => true, 'id' => $db->lastInsertId()], 201);
        break;

    case 'return':
        requireRole(['admin', 'librarian', 'tester']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['error' => 'POST metodu gerekli'], 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? 0;

        if (empty($id)) {
            jsonResponse(['error' => 'Ödünç kaydı ID gerekli'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM borrows WHERE id = ? AND status IN ('borrowed','overdue')");
        $stmt->execute([$id]);
        $borrow = $stmt->fetch();
        if (!$borrow) {
            jsonResponse(['error' => 'Aktif ödünç kaydı bulunamadı'], 404);
        }

        // Update borrow record
        $db->prepare("UPDATE borrows SET return_date = CURRENT_DATE, status = 'returned' WHERE id = ?")->execute([$id]);

        // Increase available count
        $db->prepare("UPDATE books SET available = available + 1 WHERE id = ?")->execute([$borrow['book_id']]);

        jsonResponse(['success' => true]);
        break;

    case 'stats':
        $stats = [];

        $stmt = $db->query("SELECT COUNT(*) as total, SUM(quantity) as total_copies, SUM(available) as available_copies FROM books");
        $booksStats = $stmt->fetch();
        $stats['total_books'] = (int) $booksStats['total'];
        $stats['total_copies'] = (int) $booksStats['total_copies'];
        $stats['available_copies'] = (int) $booksStats['available_copies'];

        $stmt = $db->query("SELECT COUNT(*) as total FROM members WHERE status='active'");
        $stats['total_members'] = (int) $stmt->fetch()['total'];

        $stmt = $db->query("SELECT COUNT(*) as total FROM borrows WHERE status='borrowed'");
        $stats['active_borrows'] = (int) $stmt->fetch()['total'];

        $today = date('Y-m-d');
        $stmt = $db->prepare("SELECT COUNT(*) as total FROM borrows WHERE status IN ('borrowed','overdue') AND due_date < ?");
        $stmt->execute([$today]);
        $stats['overdue'] = (int) $stmt->fetch()['total'];

        $stmt = $db->query("SELECT COUNT(*) as total FROM borrows WHERE status='returned'");
        $stats['returned'] = (int) $stmt->fetch()['total'];

        // Recent borrows
        $stmt = $db->query("
            SELECT b.*, bk.title as book_title, m.full_name as member_name
            FROM borrows b
            JOIN books bk ON b.book_id = bk.id
            JOIN members m ON b.member_id = m.id
            ORDER BY b.created_at DESC LIMIT 5
        ");
        $stats['recent_borrows'] = $stmt->fetchAll();

        // Popular books
        $stmt = $db->query("
            SELECT bk.title, bk.author, COUNT(b.id) as borrow_count
            FROM borrows b
            JOIN books bk ON b.book_id = bk.id
            GROUP BY b.book_id
            ORDER BY borrow_count DESC LIMIT 5
        ");
        $stats['popular_books'] = $stmt->fetchAll();

        jsonResponse($stats);
        break;

    default:
        jsonResponse(['error' => 'Geçersiz işlem'], 400);
}
