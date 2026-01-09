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
// Enhanced speech-to-text.php for better cross-browser support
// Add more detailed error logging
ini_set("log_errors", 1);
error_reporting(E_ALL);

// Create a log file for debugging
$logDir = dirname(dirname(__DIR__)) . "/logs/";
if (!file_exists($logDir)) {
  mkdir($logDir, 0755, true);
}
$logFile = $logDir . "audio_debug.log";

function debugLog($message)
{
  global $logFile;
  file_put_contents(
    $logFile,
    date("Y-m-d H:i:s") . ": " . $message . "\n",
    FILE_APPEND,
  );
}

try {
  debugLog("Request started");

  // Rotate log if it's too large (5MB)
  if (file_exists($logFile) && filesize($logFile) > 5242880) {
    rename($logFile, $logDir . "audio_debug_" . date("Y-m-d_H-i-s") . ".log");
  }

  // Load configuration and security handler
  require_once __DIR__ . "/../../config/config.php";
  require_once __DIR__ . "/../../config/security-handler.php";

  // Initialize security handler
  $securityHandler = new SecurityHandler($_SERVER["REMOTE_ADDR"]);

  // Check if request is allowed
  if (!$securityHandler->isAllowedRequest("audio", 100, 86400)) {
    debugLog("Rate limit exceeded");
    http_response_code(429);
    echo json_encode([
      "error" => "Too many audio requests. Please wait a few minutes.",
    ]);
    exit();
  }

  // Check if file was uploaded
  if (!isset($_FILES["audio"]) || $_FILES["audio"]["error"] !== UPLOAD_ERR_OK) {
    debugLog(
      "No audio file uploaded or upload error: " . $_FILES["audio"]["error"],
    );
    http_response_code(400);
    echo json_encode(["error" => "No audio file uploaded"]);
    exit();
  }

  // Log browser info
  $browser = $_POST["browser"] ?? "unknown";
  debugLog(
    "Browser: $browser, File type: " .
      $_FILES["audio"]["type"] .
      ", Size: " .
      $_FILES["audio"]["size"],
  );

  // Validate file size (10MB limit)
  if ($_FILES["audio"]["size"] > 10485760) {
    debugLog("File size exceeds limit");
    http_response_code(400);
    echo json_encode(["error" => "File size exceeds limit"]);
    exit();
  }

  // Process the file
  $audioFile = $_FILES["audio"]["tmp_name"];
  $fileName = $_FILES["audio"]["name"];

  // Prepare for OpenAI API
  $ch = curl_init("https://api.openai.com/v1/audio/transcriptions");
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $OPENAI_API_KEY",
  ]);

  // Create CURLFile with proper mime type
  $mimeType = $_FILES["audio"]["type"];
  if ($mimeType === "application/octet-stream") {
    $mimeType = "audio/wav"; // Default to WAV
  }

  $cFile = new CURLFile($audioFile, $mimeType, $fileName);
  $postData = [
    "file" => $cFile,
    "model" => "whisper-1",
    "language" => "en", // Specify language for better accuracy
  ];

  curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);

  $response = curl_exec($ch);
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlError = curl_error($ch);
  curl_close($ch);

  if ($curlError) {
    debugLog("cURL error: $curlError");
  }

  debugLog("API Response status: $status");

  if ($status === 200) {
    $data = json_decode($response, true);
    if (isset($data["text"])) {
      debugLog("Success - Text length: " . strlen($data["text"]));
      $securityHandler->logSuccessfulRequest();
      header("Content-Type: application/json");
      echo json_encode(["text" => $data["text"]]);
    } else {
      debugLog("Invalid response format");
      throw new Exception("Invalid response from speech-to-text service");
    }
  } else {
    debugLog("API error: $response");
    throw new Exception("Speech-to-text service error: " . $response);
  }
} catch (Exception $e) {
  debugLog("Exception: " . $e->getMessage());
  error_log("Speech-to-text Error: " . $e->getMessage());
  http_response_code(500);
  echo json_encode(["error" => $e->getMessage()]);
}
?>