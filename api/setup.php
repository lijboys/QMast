<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) jsonOut(['error' => '参数错误'], 400);

// Step 1: 保存 Turnstile 配置
if (!empty($input['turnstile_site_key']) && !empty($input['turnstile_secret'])) {
  $siteKey = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['turnstile_site_key']);
  $secret = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['turnstile_secret']);

  $localConfig = '<?php' . "\n";
  $localConfig .= "define('TURNSTILE_SITE_KEY', '" . $siteKey . "');\n";
  $localConfig .= "define('TURNSTILE_SECRET', '" . $secret . "');\n";

  $written = file_put_contents(__DIR__ . '/config.local.php', $localConfig);
  if ($written === false) {
    jsonOut(['error' => '无法写入配置文件，请检查目录权限'], 500);
  }
}

// Step 2: 创建管理员账号
if (!empty($input['email']) && !empty($input['password'])) {
  $email = trim($input['email']);
  $password = $input['password'];

  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonOut(['error' => '邮箱格式不正确'], 400);
  }
  if (strlen($password) < 6) {
    jsonOut(['error' => '密码至少6位'], 400);
  }

  $db = getDB();
  $stmt = $db->prepare('SELECT id FROM users WHERE email = :email');
  $stmt->bindValue(':email', $email, SQLITE3_TEXT);
  if ($stmt->execute()->fetchArray()) {
    jsonOut(['error' => '该邮箱已注册'], 409);
  }

  $hash = password_hash($password, PASSWORD_BCRYPT);
  $token = bin2hex(random_bytes(32));

  $stmt = $db->prepare('INSERT INTO users (email, password, token) VALUES (:email, :password, :token)');
  $stmt->bindValue(':email', $email, SQLITE3_TEXT);
  $stmt->bindValue(':password', $hash, SQLITE3_TEXT);
  $stmt->bindValue(':token', $token, SQLITE3_TEXT);
  $stmt->execute();

  jsonOut(['success' => true, 'token' => $token, 'email' => $email, 'user_id' => $db->lastInsertRowID()]);
}

jsonOut(['success' => true]);
