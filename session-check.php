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
// Start a session
session_start();

// Set a session variable to identify a browser
$_SESSION["is_browser"] = true;

// Get the return URL or default to home
$return_url = isset($_GET["return"]) ? $_GET["return"] : "/";

// Make sure the URL is safe (prevent header injection)
$return_url = filter_var($return_url, FILTER_SANITIZE_URL);

// Redirect back to the requested resource
header("Location: $return_url");
exit();
?>