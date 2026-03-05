<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Load .env file if exists (for local development)
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0)
            continue;
        if (strpos($line, '=') === false)
            continue;
        list($key, $value) = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
        putenv(trim($key) . '=' . trim($value));
    }
}

// Determine database driver
$dbDriver = $_ENV['APP_DB_DRIVER'] ?? getenv('APP_DB_DRIVER') ?: 'sqlite';

try {
    if ($dbDriver === 'mysql') {
        // MySQL connection (for Railway / cloud)
        // Railway provides MYSQL_URL or MYSQLDATABASE, MYSQLHOST, etc.
        $mysqlUrl = $_ENV['MYSQL_URL'] ?? getenv('MYSQL_URL') ?: null;

        if ($mysqlUrl) {
            // Parse Railway's MYSQL_URL: mysql://user:pass@host:port/dbname
            $parsed = parse_url($mysqlUrl);
            $dbHost = $parsed['host'];
            $dbPort = $parsed['port'] ?? 3306;
            $dbName = ltrim($parsed['path'], '/');
            $dbUser = $parsed['user'];
            $dbPass = $parsed['pass'] ?? '';
        } else {
            $dbHost = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: 'localhost';
            $dbPort = $_ENV['DB_PORT'] ?? getenv('DB_PORT') ?: '3306';
            $dbName = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: 'library_db';
            $dbUser = $_ENV['DB_USER'] ?? getenv('DB_USER') ?: 'root';
            $dbPass = $_ENV['DB_PASSWORD'] ?? getenv('DB_PASSWORD') ?: '';
        }

        $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
        $db = new PDO($dsn, $dbUser, $dbPass);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    } else {
        // SQLite connection (local development)
        $dbPath = __DIR__ . '/../database.sqlite';
        $db = new PDO('sqlite:' . $dbPath);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $db->exec('PRAGMA journal_mode=WAL');
        $db->exec('PRAGMA foreign_keys=ON');
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Veritabanı bağlantı hatası: ' . $e->getMessage()]);
    exit;
}

// Table creation — compatible with both SQLite and MySQL
if ($dbDriver === 'mysql') {
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'librarian',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            author VARCHAR(255) NOT NULL,
            isbn VARCHAR(20),
            publisher VARCHAR(255),
            year INT,
            category VARCHAR(100),
            quantity INT NOT NULL DEFAULT 1,
            available INT NOT NULL DEFAULT 1,
            cover_image TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            address TEXT,
            membership_date DATE DEFAULT (CURRENT_DATE),
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS borrows (
            id INT AUTO_INCREMENT PRIMARY KEY,
            book_id INT NOT NULL,
            member_id INT NOT NULL,
            borrow_date DATE NOT NULL DEFAULT (CURRENT_DATE),
            due_date DATE NOT NULL,
            return_date DATE,
            status VARCHAR(50) NOT NULL DEFAULT 'borrowed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} else {
    // SQLite table creation (original)
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'librarian',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            isbn TEXT,
            publisher TEXT,
            year INTEGER,
            category TEXT,
            quantity INTEGER NOT NULL DEFAULT 1,
            available INTEGER NOT NULL DEFAULT 1,
            cover_image TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            address TEXT,
            membership_date DATE DEFAULT CURRENT_DATE,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS borrows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
            due_date DATE NOT NULL,
            return_date DATE,
            status TEXT NOT NULL DEFAULT 'borrowed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )
    ");
}

// Seed default users if none exists
$stmt = $db->query("SELECT COUNT(*) as cnt FROM users");
$row = $stmt->fetch();
if ($row['cnt'] == 0) {
    $seedUsers = [
        ['admin', 'admin123', 'Sistem Yöneticisi', 'admin'],
        ['librarian', 'lib123', 'Kütüphaneci Ayşe', 'librarian'],
        ['tester', 'test123', 'Test Kullanıcı', 'tester'],
        ['ahmet', 'ahmet123', 'Ahmet Yılmaz', 'member'],
        ['ayse', 'ayse123', 'Ayşe Demir', 'member'],
        ['mehmet', 'mehmet123', 'Mehmet Kaya', 'member'],
        ['fatma', 'fatma123', 'Fatma Öztürk', 'member'],
        ['ali', 'ali123', 'Ali Çelik', 'member'],
    ];
    $insertUser = $db->prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
    foreach ($seedUsers as $u) {
        $insertUser->execute([$u[0], password_hash($u[1], PASSWORD_DEFAULT), $u[2], $u[3]]);
    }
}

// Seed sample data if books table is empty
$stmt = $db->query("SELECT COUNT(*) as cnt FROM books");
$row = $stmt->fetch();
if ($row['cnt'] == 0) {
    $sampleBooks = [
        ['Suç ve Ceza', 'Fyodor Dostoyevski', '978-975-07-0254-5', 'İş Bankası Kültür Yayınları', 2020, 'Roman', 3],
        ['1984', 'George Orwell', '978-975-07-0673-4', 'Can Yayınları', 2021, 'Distopya', 5],
        ['Küçük Prens', 'Antoine de Saint-Exupéry', '978-975-07-0890-5', 'Can Yayınları', 2019, 'Çocuk Edebiyatı', 4],
        ['Sefiller', 'Victor Hugo', '978-975-07-1234-6', 'İş Bankası Kültür Yayınları', 2018, 'Klasik', 2],
        ['Simyacı', 'Paulo Coelho', '978-975-07-5678-9', 'Can Yayınları', 2022, 'Roman', 6],
        ['Dönüşüm', 'Franz Kafka', '978-975-07-9012-3', 'İş Bankası Kültür Yayınları', 2020, 'Klasik', 3],
        ['Yüzüklerin Efendisi', 'J.R.R. Tolkien', '978-975-07-3456-7', 'Metis Yayınları', 2021, 'Fantastik', 2],
        ['Harry Potter ve Felsefe Taşı', 'J.K. Rowling', '978-975-07-7890-1', 'Yapı Kredi Yayınları', 2023, 'Fantastik', 4],
    ];
    $insertBook = $db->prepare("INSERT INTO books (title, author, isbn, publisher, year, category, quantity, available) VALUES (?,?,?,?,?,?,?,?)");
    foreach ($sampleBooks as $b) {
        $insertBook->execute([$b[0], $b[1], $b[2], $b[3], $b[4], $b[5], $b[6], $b[6]]);
    }

    // Sample members
    $sampleMembers = [
        ['Ahmet Yılmaz', 'ahmet@mail.com', '555-0001', 'Ankara, Çankaya'],
        ['Ayşe Demir', 'ayse@mail.com', '555-0002', 'İstanbul, Kadıköy'],
        ['Mehmet Kaya', 'mehmet@mail.com', '555-0003', 'İzmir, Alsancak'],
        ['Fatma Öztürk', 'fatma@mail.com', '555-0004', 'Bursa, Nilüfer'],
        ['Ali Çelik', 'ali@mail.com', '555-0005', 'Antalya, Muratpaşa'],
    ];
    $insertMember = $db->prepare("INSERT INTO members (full_name, email, phone, address) VALUES (?,?,?,?)");
    foreach ($sampleMembers as $m) {
        $insertMember->execute([$m[0], $m[1], $m[2], $m[3]]);
    }
}

function requireAuth()
{
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Oturum açmanız gerekiyor']);
        exit;
    }
}

function requireRole($allowedRoles)
{
    requireAuth();
    $role = $_SESSION['active_role'] ?? $_SESSION['role'] ?? '';
    if (!in_array($role, $allowedRoles)) {
        http_response_code(403);
        echo json_encode(['error' => 'Bu işlem için yetkiniz yok'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function jsonResponse($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
