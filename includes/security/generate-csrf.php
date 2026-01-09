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

// Start session if not already started
if (session_status() == PHP_SESSION_NONE) {
  session_start();
}

// Generate a cryptographically secure random token
function generateToken($length = 32)
{
  // Use random_bytes() if available (PHP 7+)
  if (function_exists("random_bytes")) {
    return bin2hex(random_bytes($length / 2));
  }

  // Fall back to openssl_random_pseudo_bytes()
  if (function_exists("openssl_random_pseudo_bytes")) {
    return bin2hex(openssl_random_pseudo_bytes($length / 2));
  }

  // Last resort, less secure fallback
  $characters =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  $result = "";
  for ($i = 0; $i < $length; $i++) {
    $result .= $characters[rand(0, strlen($characters) - 1)];
  }
  return $result;
}

// Generate a new CSRF token
$token = generateToken();

// Store the token in the session
$_SESSION["csrf_token"] = $token;

// Return the token
echo $token;
?>