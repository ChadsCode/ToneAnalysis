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
header("Content-Type: application/javascript");
header("X-Content-Type-Options: nosniff");

$allowedDomains = ["toneanalysis.com", "www.toneanalysis.com"];

// Block if Referer header is missing or invalid
$isAllowed = false;
if (isset($_SERVER["HTTP_REFERER"])) {
  foreach ($allowedDomains as $domain) {
    if (strpos($_SERVER["HTTP_REFERER"], $domain) !== false) {
      $isAllowed = true;
      break;
    }
  }
}

if (!$isAllowed) {
  http_response_code(403);
  exit("🔒 Access denied.");
}

// You've already set these headers above, so these lines are redundant:
// header('Content-Type: application/javascript');
// header('X-Content-Type-Options: nosniff');
// header('Cache-Control: no-cache, must-revalidate');
// header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');

readfile(".g934sdj.js"); // Rename this if you're using a different obfuscated file