<?php
require_once __DIR__ . '/config.php';

$user = getAuthUser();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  // 拉取云端记录
  $since = isset($_GET['since']) ? intval($_GET['since']) : 0;
  $stmt = $db->prepare('SELECT timestamp, date, time, triggers FROM records WHERE user_id = :uid AND timestamp > :since ORDER BY timestamp ASC');
  $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
  $stmt->bindValue(':since', $since, SQLITE3_INTEGER);
  $result = $stmt->execute();
  $records = [];
  while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $row['triggers'] = json_decode($row['triggers'] ?? '[]', true) ?: [];
    $records[] = $row;
  }
  jsonOut(['records' => $records, 'server_time' => time() * 1000]);
}

if ($method === 'POST') {
  // 推送记录到云端
  $input = json_decode(file_get_contents('php://input'), true);
  if (!$input || !isset($input['records']) || !is_array($input['records'])) {
    jsonOut(['error' => '参数错误'], 400);
  }

  $inserted = 0;
  $stmt = $db->prepare('INSERT OR REPLACE INTO records (user_id, timestamp, date, time, triggers) VALUES (:uid, :ts, :date, :time, :triggers)');

  foreach ($input['records'] as $r) {
    $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
    $stmt->bindValue(':ts', intval($r['timestamp']), SQLITE3_INTEGER);
    $stmt->bindValue(':date', $r['date'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':time', $r['time'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':triggers', json_encode($r['triggers'] ?? []), SQLITE3_TEXT);
    $stmt->execute();
    if ($db->changes()) $inserted++;
  }

  jsonOut(['inserted' => $inserted, 'total' => count($input['records'])]);
}

if ($method === 'DELETE') {
  $input = json_decode(file_get_contents('php://input'), true);
  if (!$input || !isset($input['timestamps']) || !is_array($input['timestamps'])) {
    jsonOut(['error' => '参数错误'], 400);
  }

  $deleted = 0;
  $stmt = $db->prepare('DELETE FROM records WHERE user_id = :uid AND timestamp = :ts');
  foreach ($input['timestamps'] as $ts) {
    $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
    $stmt->bindValue(':ts', intval($ts), SQLITE3_INTEGER);
    $stmt->execute();
    $deleted += $db->changes();
  }

  jsonOut(['deleted' => $deleted, 'total' => count($input['timestamps'])]);
}

jsonOut(['error' => '不支持的方法'], 405);
