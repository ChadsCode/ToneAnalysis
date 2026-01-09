<?php
/*
 * Part of ToneAnalysis.com project.
 * GitHub: https://github.com/ChadsCode/ToneAnalysis
 * License: MIT Open-Source
 * Website: https://www.toneanalysis.com/
 * Copyright (c) 2025 Chad Wigington
 * LinkedIn: https://www.linkedin.com/in/chadwigington/
 */
// Modified security-handler.php to support email tone changes without affecting daily limits

class SecurityHandler
{
  private $clientIP;
  private $countUsage;

  // Constructor now accepts a parameter to determine if usage should be counted
  public function __construct($clientIP, $countUsage = true)
  {
    $this->clientIP = $clientIP;
    $this->countUsage = $countUsage;

    // Start the session if it's not already started
    if (session_status() == PHP_SESSION_NONE) {
      session_start();
    }
  }

  /**
   * Check if a request is allowed based on rate limits
   *
   * @param string $type The type of request (e.g., 'text', 'audio')
   * @param int $limit The maximum number of requests allowed in the time period
   * @param int $period The time period in seconds (e.g., 3600 for 1 hour)
   *
   * @return bool True if the request is allowed, false otherwise
   */
  public function isAllowedRequest($type, $limit, $period)
  {
    $key = "rate_limit_{$type}";

    // Initialize or get existing rate limit data
    if (!isset($_SESSION[$key])) {
      $_SESSION[$key] = [
        "count" => 0,
        "reset" => time() + $period,
      ];
    }

    // Check if the rate limit period has expired
    if (time() > $_SESSION[$key]["reset"]) {
      $_SESSION[$key] = [
        "count" => 0,
        "reset" => time() + $period,
      ];
    }

    // Check if the request count has exceeded the limit
    if ($_SESSION[$key]["count"] >= $limit) {
      return false;
    }

    // Increment count only if countUsage is true
    if ($this->countUsage) {
      $_SESSION[$key]["count"]++;
    }

    return true;
  }

  /**
   * Log a successful request (without incrementing the counter)
   * This can be used for tracking successful requests for metrics
   */
  public function logSuccessfulRequest()
  {
    // Implement any additional logging logic here if needed
    // For example, log to a database or file
  }
}
?>