<?php

/*
 * Part of ToneAnalysis.com project.
 * GitHub: https://github.com/ChadsCode/ToneAnalysis
 * License: MIT Open-Source
 * Website: https://www.toneanalysis.com/
 * Copyright (c) 2025 Chad Wigington
 * LinkedIn: https://www.linkedin.com/in/chadwigington/
 */
// Cache busting headers
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Sat, 01 Jan 2000 00:00:00 GMT");
session_start();
require_once __DIR__ . "/../../config/security-handler.php";

$clientIP = $_SERVER["REMOTE_ADDR"];
$securityHandler = new SecurityHandler($clientIP);

// Get text analysis rate limits
$textRateKey = "rate_limit_text";
$textData = $_SESSION[$textRateKey] ?? ["count" => 0, "reset" => time() + 3600];
$textRemaining = max(0, 100 - $textData["count"]);

// We'll keep the audio data structure in the response for backward compatibility,
// but it won't be displayed in the UI anymore
$audioRateKey = "rate_limit_audio";
$audioData = $_SESSION[$audioRateKey] ?? [
  "count" => 0,
  "reset" => time() + 3600,
];
$audioRemaining = max(0, 100 - $audioData["count"]);

header("Content-Type: application/json");
echo json_encode([
  "text" => [
    "remaining" => $textRemaining,
    "limit" => 100,
    "reset" => $textData["reset"],
  ],
  "audio" => [
    "remaining" => $audioRemaining,
    "limit" => 100,
    "reset" => $audioData["reset"],
  ],
]);
?>