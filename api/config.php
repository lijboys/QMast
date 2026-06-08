<?php
// ====== 数据库配置 ======
define('DB_PATH', __DIR__ . '/data.db');

// 加载本地配置（由安装向导生成）
$localConf = __DIR__ . '/config.local.php';
if (file_exists($localConf)) {
  require_once $localConf;
} else {
  define('TURNSTILE_SITE_KEY', '');
  define('TURNSTILE_SECRET', '');
}

// CORS 跨域
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

function getDB() {
  static $db = null;
  if ($db) return $db;
  $db = new SQLite3(DB_PATH);
  $db->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    token TEXT,
    created_at TEXT DEFAULT (datetime("now"))
  )');
  $db->exec('CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    triggers TEXT DEFAULT "[]",
    created_at TEXT DEFAULT (datetime("now"))
  )');
  $db->exec('DELETE FROM records WHERE id NOT IN (SELECT MIN(id) FROM records GROUP BY user_id, timestamp)');
  $db->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_records_user_timestamp ON records(user_id, timestamp)');
  return $db;
}

// 验证 Turnstile Token（客户端传入）
function verifyTurnstile($token) {
  if (!TURNSTILE_SECRET || TURNSTILE_SECRET === '0x4AAAAAAAxT2EXAMPLE_KEY') {
    return true; // 未配置时跳过验证
  }
  $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'secret' => TURNSTILE_SECRET,
    'response' => $token,
    'remoteip' => $_SERVER['REMOTE_ADDR']
  ]));
  $resp = json_decode(curl_exec($ch), true);
  curl_close($ch);
  return $resp && $resp['success'] === true;
}

function jsonOut($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function requestHeaders() {
  if (function_exists('getallheaders')) return getallheaders();
  $headers = [];
  foreach ($_SERVER as $key => $value) {
    if (strpos($key, 'HTTP_') === 0) {
      $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
      $headers[$name] = $value;
    }
  }
  return $headers;
}

function getAuthUser() {
  $headers = requestHeaders();
  $token = '';
  foreach ($headers as $name => $value) {
    if (strtolower($name) === 'authorization') {
      $token = trim(str_replace('Bearer ', '', $value));
      break;
    }
  }
  if (!$token) jsonOut(['error' => '未登录'], 401);
  $db = getDB();
  $stmt = $db->prepare('SELECT id, email FROM users WHERE token = :token');
  $stmt->bindValue(':token', $token, SQLITE3_TEXT);
  $user = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
  if (!$user) jsonOut(['error' => 'token无效'], 401);
  return $user;
}
