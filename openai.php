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

// Add security headers
header(
  "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://*.cloudflareinsights.com https://*.google-analytics.com https://*.googletagmanager.com https://*.analytics.google.com https://*.g.doubleclick.net https://*.google.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https: https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com; connect-src 'self' https://*.openai.com https://*.google-analytics.com https://*.analytics.google.com https://*.g.doubleclick.net https://*.doubleclick.net https://*.cloudflareinsights.com https://*.cloudflarestatus.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; frame-src 'self' https://*.google.com; media-src 'self' blob:; object-src 'none';",
);
header("X-Frame-Options: DENY");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: strict-origin-when-cross-origin");

// openai.php
// Secure server-side proxy for OpenAI API.
// Ensure that config.php is stored outside public_html.
error_reporting(E_ALL);
ini_set("display_errors", 0);
ini_set("log_errors", 1);
try {
  // Load configuration and security handler
  require_once __DIR__ . "/../../config/config.php";
  require_once __DIR__ . "/../../config/security-handler.php";

  // DEBUG LOGGING
  $logDir = dirname(dirname(__DIR__)) . "/logs/";
  if (!file_exists($logDir)) {
    mkdir($logDir, 0755, true);
  }
  $logFile = fopen($logDir . "debug_openai.log", "a");
  // Rotate log if it's too large (5MB)
  if (
    file_exists($logDir . "debug_openai.log") &&
    filesize($logDir . "debug_openai.log") > 5242880
  ) {
    rename(
      $logDir . "debug_openai.log",
      $logDir . "debug_openai_" . date("Y-m-d_H-i-s") . ".log",
    );
  }
  fwrite(
    $logFile,
    "========= NEW REQUEST " . date("Y-m-d H:i:s") . " =========\n",
  );

  // Log all headers
  $allHeaders = function_exists("getallheaders") ? getallheaders() : [];
  fwrite($logFile, "All headers received:\n");
  foreach ($allHeaders as $name => $value) {
    fwrite(
      $logFile,
      "  $name: " .
        (strtolower($name) === "authorization" ? "HIDDEN" : $value) .
        "\n",
    );
  }

  // Log request method
  fwrite($logFile, "Request method: " . $_SERVER["REQUEST_METHOD"] . "\n");

  // Log content type
  fwrite(
    $logFile,
    "Content-Type: " . ($_SERVER["CONTENT_TYPE"] ?? "not set") . "\n",
  );

  // Initialize security handler
  $securityHandler = new SecurityHandler($_SERVER["REMOTE_ADDR"]);

  // Check if request is allowed by security handler (100 requests per day limit)
  if (!$securityHandler->isAllowedRequest("text", 100, 86400)) {
    fwrite($logFile, "Request blocked by rate limit\n");
    fclose($logFile);
    http_response_code(429);
    echo json_encode([
      "error" => "You've reached the hourly limit. Please wait a few minutes.",
    ]);
    exit();
  }

  // Check for API key in config
  if (!isset($OPENAI_API_KEY) || empty($OPENAI_API_KEY)) {
    fwrite($logFile, "API key not configured\n");
    fclose($logFile);
    throw new Exception("API key not configured");
  }

  // Validate request method
  if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    fwrite(
      $logFile,
      "Invalid request method: " . $_SERVER["REQUEST_METHOD"] . "\n",
    );
    fclose($logFile);
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit();
  }

  // Validate content type
  $contentType = isset($_SERVER["CONTENT_TYPE"])
    ? $_SERVER["CONTENT_TYPE"]
    : "";
  if (strpos($contentType, "application/json") === false) {
    fwrite($logFile, "Invalid content type: $contentType\n");
    fclose($logFile);
    http_response_code(400);
    echo json_encode(["error" => "Invalid content type"]);
    exit();
  }

  // Get and validate request body
  $requestBody = file_get_contents("php://input");
  if (!$requestBody) {
    fwrite($logFile, "No input provided\n");
    fclose($logFile);
    throw new Exception("No input provided");
  }

  // Parse JSON input
  $requestData = json_decode($requestBody, true);
  if (json_last_error() !== JSON_ERROR_NONE) {
    fwrite($logFile, "Invalid JSON provided: " . json_last_error_msg() . "\n");
    fclose($logFile);
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON provided"]);
    exit();
  }

  // Validate required fields
  if (
    !isset($requestData["messages"]) ||
    !is_array($requestData["messages"]) ||
    count($requestData["messages"]) < 1
  ) {
    fwrite($logFile, "Invalid request format: messages field required\n");
    fclose($logFile);
    http_response_code(400);
    echo json_encode([
      "error" => "Invalid request format: messages field required",
    ]);
    exit();
  }

  // Check for malicious content
  $maliciousPatterns = [
    "eval\s*\(",
    "exec\s*\(",
    "system\s*\(",
    "<script",
    "DROP TABLE",
    "DELETE FROM",
    "UPDATE .* SET",
  ];

  foreach ($requestData["messages"] as $message) {
    if (isset($message["content"])) {
      $content = $message["content"];
      foreach ($maliciousPatterns as $pattern) {
        if (preg_match("/" . $pattern . "/i", $content)) {
          fwrite($logFile, "Potentially malicious content detected\n");
          fclose($logFile);
          error_log("Potentially malicious content detected");
          http_response_code(400);
          echo json_encode(["error" => "Invalid input detected"]);
          exit();
        }
      }
    }
  }

  // Ensure model is valid
  $allowedModels = ["gpt-4-turbo", "gpt-4", "text-davinci-003"];
  if (
    !isset($requestData["model"]) ||
    !in_array($requestData["model"], $allowedModels)
  ) {
    $requestData["model"] = "gpt-4-turbo";
  }

  // Limit temperature range
  if (
    isset($requestData["temperature"]) &&
    ($requestData["temperature"] < 0 || $requestData["temperature"] > 1)
  ) {
    $requestData["temperature"] = 0.7;
  }

  // Limit token usage
  if (!isset($requestData["max_tokens"]) || $requestData["max_tokens"] > 1000) {
    $requestData["max_tokens"] = 1000;
  }

  // Process system prompt for mode-specific enhancements
  if (isset($requestData["messages"]) && count($requestData["messages"]) > 0) {
    $systemMessage = null;

    // Find the system message
    foreach ($requestData["messages"] as $key => $message) {
      if ($message["role"] === "system") {
        $systemMessage = $message;
        $systemMessageIndex = $key;
        break;
      }
    }

    // Apply algorithmic layers based on message content
    if ($systemMessage) {
      $content = $systemMessage["content"];

      // Check if this is a professional tone request
      if (
        strpos(
          $content,
          "User Profile: Interdependent, Slightly Status, Certainty-seeking, Direct, Balanced",
        ) !== false
      ) {
        // Apply Professional Profile to ensure it matches the default profile
        $content = addProfessionalProfile($content);

        // Apply Grok Mathematical Algorithm
        $content = applyGrokAlgorithm($content);

        // Apply Professional Response Algorithm
        $content = applyProfessionalResponseAlgorithm($content);

        // Update the system message
        $requestData["messages"][$systemMessageIndex]["content"] = $content;
      }

      // Always apply these layers
      // Apply Natural Language Processing enhancements
      $content = applyNLPEnhancements($content);

      // Apply Humanized Algorithm
      $content = applyHumanizedAlgorithm($content);

      // Update the system message
      $requestData["messages"][$systemMessageIndex]["content"] = $content;
    }
  }

  // Prepare sanitized request body
  $sanitizedRequestBody = json_encode($requestData);
  fwrite($logFile, "Request ready to send to OpenAI API\n");

  // Set up curl request to OpenAI
  $ch = curl_init("https://api.openai.com/v1/chat/completions");
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $sanitizedRequestBody);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer $OPENAI_API_KEY",
    "User-Agent: ToneAnalysis/1.0",
  ]);

  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

  $response = curl_exec($ch);
  if (curl_errno($ch)) {
    $curlError = curl_error($ch);
    fwrite($logFile, "cURL error: $curlError\n");
    fclose($logFile);
    throw new Exception("cURL error: " . $curlError);
  }

  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  fwrite($logFile, "OpenAI API response status: $status\n");

  if ($status === 200) {
    fwrite($logFile, "Request successful, logging in security handler\n");
    $securityHandler->logSuccessfulRequest();
  }

  http_response_code($status);

  if ($status === 200 && $response) {
    $responseData = json_decode($response, true);
    if (
      json_last_error() === JSON_ERROR_NONE &&
      isset($responseData["choices"])
    ) {
      fwrite($logFile, "Valid response from OpenAI, sending to client\n");
      fclose($logFile);
      header("Content-Type: application/json");
      echo $response;
    } else {
      fwrite($logFile, "Invalid response format from OpenAI\n");
      fclose($logFile);
      throw new Exception("Received invalid response format from AI service");
    }
  } else {
    fwrite($logFile, "Error from OpenAI API: Status $status\n");
    if ($response) {
      fwrite($logFile, "Response: " . substr($response, 0, 500) . "\n");
    }
    fclose($logFile);
    error_log("Error from OpenAI API: Status $status");
    header("Content-Type: application/json");
    echo $response;
  }
} catch (Exception $e) {
  if (isset($logFile) && is_resource($logFile)) {
    fwrite($logFile, "ERROR: " . $e->getMessage() . "\n");
    fclose($logFile);
  }
  error_log("OpenAI API Error: " . $e->getMessage());
  http_response_code(500);
  echo json_encode(["error" => $e->getMessage()]);
}

// === ALGORITHMIC LAYER FUNCTIONS ===

// Apply Natural Language Processing Engine enhancements
function applyNLPEnhancements($content)
{
  // Add NLP-specific instructions from Natural Language Processing - all tabs.txt
  $nlpInstructions = "
    As part of your processing, ensure you:
    - Detect sentiment accurately and thoroughly
    - Score tone intensity appropriately (subtle to strong)
    - Track changes in emotion throughout the text
    - Identify risky or non-neutral language
    - Ensure the output is natural and undetectable by AI checkers (ZeroGPT, Turnitin, plagiarism detectors)
    ";

  // Append NLP instructions
  return $content . $nlpInstructions;
}

// Apply Humanized Algorithm
function applyHumanizedAlgorithm($content)
{
  // Add humanizing instructions from Humanized Algorithm for Humanized tab.odt
  $humanizedInstructions = "
    When generating content, dynamically adjust the writing to sound more human by:
    - Adapting phrasing based on detected emotion
    - Softening negative tones appropriately
    - Enhancing emotional accuracy
    - Matching the communication style to the user's behavioral profile
    - Ensuring the response feels natural and relatable
    ";

  // Append humanizing instructions
  return $content . $humanizedInstructions;
}

// Add Professional Profile
function addProfessionalProfile($content)
{
  // Ensure professional profile is correctly specified
  $profileInstructions = "
    Apply the following professional behavioral profile baseline when generating content:
    - Interdependent (45:55): Slightly favor collaborative, inclusive language
    - Slightly Status (48:52): Show subtle awareness of hierarchy while remaining approachable
    - Certainty-seeking (35:65): Use clear, definitive language with appropriate detail
    - Direct (60:40): Be straightforward while maintaining politeness
    - Balanced (50:50 Task vs Relationship): Equal focus on objectives and interpersonal connection
    ";

  // Append profile instructions
  return $content . $profileInstructions;
}

// Apply Grok Mathematical Algorithm
function applyGrokAlgorithm($content)
{
  // Add mathematical analysis instructions from Grok Mathematical Algorithm - Original.odt
  $grokInstructions = "
    Apply these mathematical sentiment analysis principles:
    - Calculate sentiment_score on a range from -1.0 (extremely negative) to 1.0 (extremely positive)
    - Determine appropriate tone_label based on sentiment patterns
    - Develop a suggested_response_strategy based on detected tone
    - Use these metrics to guide your response generation
    ";

  // Append Grok algorithm instructions
  return $content . $grokInstructions;
}

// Apply Professional Response Algorithm
function applyProfessionalResponseAlgorithm($content)
{
  // Add professional response algorithm instructions from Professional responses Algorith rules for API.txt
  $professionalInstructions = "
    When crafting professional responses:
    - Calculate compatibility with the professional profile
    - Generate personalized content that aligns with the profile
    - Adapt language to match the professional context
    - Enforce alignment with the default professional profile dimensions
    - Maintain a natural, human-like tone throughout
    ";

  // Append professional algorithm instructions
  return $content . $professionalInstructions;
}
?>