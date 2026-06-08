<?php
require_once __DIR__ . '/config.php';

// 检查是否至少有一个用户
$db = getDB();
$count = $db->querySingle('SELECT COUNT(*) FROM users');
$hasTurnstile = defined('TURNSTILE_SITE_KEY') && TURNSTILE_SITE_KEY !== '0x4AAAAAAAxT2EXAMPLE_KEY' && TURNSTILE_SITE_KEY !== '';

jsonOut([
  'configured' => $count > 0,
  'turnstile_site_key' => $hasTurnstile ? TURNSTILE_SITE_KEY : ''
]);
