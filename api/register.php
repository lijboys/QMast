<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['email']) || empty($input['password'])) {
  jsonOut(['error' => '请填写邮箱和密码'], 400);
}

$email = trim($input['email']);
$password = $input['password'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  jsonOut(['error' => '邮箱格式不正确'], 400);
}
if (strlen($password) < 6) {
  jsonOut(['error' => '密码至少6位'], 400);
}

// Turnstile 验证
if (!verifyTurnstile($input['turnstile_token'] ?? '')) {
  jsonOut(['error' => '人机验证失败，请重试'], 400);
}

$db = getDB();
$stmt = $db->prepare('SELECT id FROM users WHERE email = :email');
$stmt->bindValue(':email', $email, SQLITE3_TEXT);
if ($stmt->execute()->fetchArray()) {
  jsonOut(['error' => '该邮箱已注册，请直接登录'], 409);
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$token = bin2hex(random_bytes(32));

$stmt = $db->prepare('INSERT INTO users (email, password, token) VALUES (:email, :password, :token)');
$stmt->bindValue(':email', $email, SQLITE3_TEXT);
$stmt->bindValue(':password', $hash, SQLITE3_TEXT);
$stmt->bindValue(':token', $token, SQLITE3_TEXT);
$stmt->execute();

jsonOut(['token' => $token, 'email' => $email, 'user_id' => $db->lastInsertRowID()]);
