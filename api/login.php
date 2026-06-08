<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['email']) || empty($input['password'])) {
  jsonOut(['error' => '请填写邮箱和密码'], 400);
}

$email = trim($input['email']);
$password = $input['password'];

if (!verifyTurnstile($input['turnstile_token'] ?? '')) {
  jsonOut(['error' => '人机验证失败，请重试'], 400);
}

$db = getDB();
$stmt = $db->prepare('SELECT id, email, password FROM users WHERE email = :email');
$stmt->bindValue(':email', $email, SQLITE3_TEXT);
$user = $stmt->execute()->fetchArray(SQLITE3_ASSOC);

if (!$user || !password_verify($password, $user['password'])) {
  jsonOut(['error' => '邮箱或密码错误'], 401);
}

$token = bin2hex(random_bytes(32));
$stmt = $db->prepare('UPDATE users SET token = :token WHERE id = :id');
$stmt->bindValue(':token', $token, SQLITE3_TEXT);
$stmt->bindValue(':id', $user['id'], SQLITE3_INTEGER);
$stmt->execute();

jsonOut(['token' => $token, 'email' => $user['email'], 'user_id' => $user['id']]);
