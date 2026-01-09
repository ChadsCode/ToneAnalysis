<!--
  Part of ToneAnalysis.com project.
  GitHub: https://github.com/ChadsCode/ToneAnalysis
  License: MIT Open-Source
  Website: https://www.toneanalysis.com/
  Copyright (c) 2025 Chad Wigington
  LinkedIn: https://www.linkedin.com/in/chadwigington/
-->
<?php
header('Content-Type: text/html; charset=UTF-8');
// Cache busting headers
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: Sat, 01 Jan 2000 00:00:00 GMT');
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- SEO Title Tag (Keywords + Domain Focus) -->
  <title>Open-Source | ToneAnalysis.com</title>

  <!-- Author Information -->
  <meta name="author" content="Chad Wigington">

  <!-- Robots Directives -->
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

  <!-- Mobile Theme Color -->
  <meta name="theme-color" content="#3a7bd5">

  <!-- Copyright -->
  <meta name="copyright" content="ToneAnalysis.com">

  <!-- Additional SEO Meta Tags -->
  <meta name="application-name" content="ToneAnalysis">
  <meta name="rating" content="General">

  <!-- Favicon and Apple Touch Icons (Root Directory) -->
  <link rel="icon" href="/favicon.ico">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32">
  <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16">

  <!-- Preconnect and DNS Prefetch for Performance -->
  <link rel="preconnect" href="https://cdnjs.cloudflare.com">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">

  <!-- Preload Critical Resources -->
  <link rel="preload" href="styles.css?v=2" as="style">
  <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" as="style">

  <!-- Stylesheets -->
  <link rel="stylesheet" href="styles.css?v=2">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

</head>

<body>
  <!-- Navigation -->
  <nav class="main-nav">
    <div class="nav-container">
      <div class="logo">
        <a href="/">
          <img src="images/tone-analysis-logo.svg" alt="Tone Analysis" class="logo-img">
        </a>
      </div>
      <ul class="nav-links">
        <li><a href="https://www.linkedin.com/in/chadwigington/" class="extension-badge"><i
              class="fa-brands fa-linkedin"></i> Chad Wigington</a></li>
        <li><a href="/" class="active"><i class="fas fa-home"></i> Home</a></li>
        <li><a href="#" id="about-link"><i class="fas fa-book"></i> Instructions</a></li>
        <li><a href="#"><i class="fas fa-info-circle"></i> Link</a></li>
        <li><a href="#"><i class="fas fa-envelope"></i> Link</a></li>
      </ul>
      <div class="hamburger">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <header class="hero">
    <div class="hero-content">
      <h1>AI Email Analyzer & Automated Rewrite</h1>
      <p>Instantly analyze, rewrite, and optimize the tone of your business emails. Created by <a
          href="https://www.linkedin.com/in/chadwigington/" class="pro-badge">Chad Wigington</a></p>
      <div class="hero-badges">
        <span class="badge"><i class="fas fa-lightbulb"></i> BETA</span>
        <span class="badge"><i class="fa-brands fa-github"></i>Open-Source</span>
        <span class="badge"><i class="fas fa-chart-line"></i> Accurate</span>
      </div>
    </div>
  </header>

  <!-- Main Content Section -->
  <main class="main-container">
    <div class="input-section">
      <div class="mode-selector">
        <div class="mode-tabs">
          <button class="mode-tab active" data-mode="draft">Draft Email</button>
          <button class="mode-tab" data-mode="email">Respond to Email</button>
          <button class="mode-tab" data-mode="analyze">Analyze Only</button>
        </div>
      </div>

      <!-- Text input with file upload -->
      <div class="textarea-wrapper">
        <textarea id="text-input"
          placeholder="Write a short prompt and we'll generate a full professional email."></textarea>
        <div class="upload-bar">
          <div class="input-options-tabs">
            <button class="tab-btn" data-tab="upload">
              <i class="fas fa-file-upload"></i> Upload
            </button>
            <button class="tab-btn" data-tab="record" id="record-btn">
              <i class="fas fa-microphone record-icon"></i>
              <span class="record-text">Record</span>
            </button>
          </div>
          <div class="record-status">
            <span id="recording-time">00:00</span> / <span id="max-recording-time">01:00</span>
          </div>
        </div>
      </div>

      <!-- Buttons -->
      <div class="button-container">
        <button id="run-analysis-btn" class="btn-primary pulse-animation">
          <i class="fas fa-magic"></i> Generate
        </button>
        <button id="refresh-btn" class="btn-secondary">
          <i class="fas fa-redo"></i> Clear
        </button>
      </div>
    </div>

    <!-- Hidden file input -->
    <input type="file" id="file-input"
      accept=".txt,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.mp3,.wav,.m4a,.ogg,.webm"
      style="display: none;">

    <!-- Output Section -->
    <div class="output-container">
      <div id="full-report" class="output-section"></div>
    </div>

    <div id="loading-overlay" class="loading-overlay"></div>

    <!-- Loading Animation -->
    <div id="loading-animation" class="loading-container" style="display: none;">
      <div class="loading-spinner"></div>
      <p>Analyzing your text..</p>
    </div>

    <!-- Instructions Modal -->
    <div id="about-modal" class="modal">
      <div class="modal-content">
        <span class="close-modal">&times;</span>
        <h2>How to Use ToneAnalysis.com</h2>
        <h3>Getting Started</h3>
        <p>ToneAnalysis.com helps you craft better professional emails in three ways. Choose your mode based on what you
          need:</p>
        <ul>
          <li><strong>Draft Email:</strong> Write a message or provide a short prompt to generate a complete email.</li>
          <li><strong>Respond to Email:</strong> Paste an email you received to create an appropriate response.</li>
          <li><strong>Analyze Only:</strong> Check the tone and sentiment of any text without changing it.</li>
        </ul>

        <h3>Basic Steps</h3>
        <ul>
          <li>Select your desired mode at the top of the input box</li>
          <li>Type or paste your text in the box (maximum 500 words)</li>
          <li>Click the "Generate" button to process your text</li>
          <li>Review your results in the section below</li>
        </ul>

        <h3>Input Options</h3>
        <p>You can add text in several ways:</p>
        <ul>
          <li><strong>Type directly</strong> in the text box</li>
          <li>Click <strong>Upload</strong> to import text from a file (TXT, PDF, DOC/DOCX)</li>
          <li>Click <strong>Record</strong> to dictate your message (up to 1 minute)</li>
        </ul>

        <h3>Understanding Results</h3>
        <p>Depending on your selected mode, you'll receive different results:</p>

        <h4>Draft Email Mode</h4>
        <p>You'll receive a fully formatted email based on your input. You can adjust the tone by selecting one of these
          options:</p>
        <ul>
          <li><strong>Proofread:</strong> Corrects spelling, grammar, and punctuation only</li>
          <li><strong>Professional:</strong> Clear, straightforward business language</li>
          <li><strong>Formal:</strong> Highly structured, proper language for official correspondence</li>
          <li><strong>Casual:</strong> Relaxed but still professional tone</li>
          <li><strong>Friendly:</strong> Warm and personable communication style</li>
        </ul>

        <h4>Respond to Email Mode</h4>
        <p>After analyzing the email you received, you'll get a complete response with subject line, greeting, body
          text, and closing. Use the tone buttons to adjust as needed.</p>

        <h4>Analyze Only Mode</h4>
        <p>You'll receive a detailed analysis of your text, including:</p>
        <ul>
          <li>Executive Summary of key points</li>
          <li>Emotional Profile detecting tone and sentiment</li>
          <li>Mindset & Bias assessment</li>
          <li>Style & Delivery analysis</li>
          <li>Strategy recommendations</li>
          <li>Language notes highlighting specific areas</li>
        </ul>

        <h3>Tips for Best Results</h3>
        <ul>
          <li>Keep inputs under 500 words for optimal analysis.</li>
          <li>Be specific about your desired outcome for Draft mode.</li>
          <li>Include the original message for context in Response mode.</li>
          <li>Use the "Copy to Clipboard" button to easily save your results.</li>
          <li>Wait 5 seconds between analyses to respect rate limits.</li>
        </ul>

        <h3>Privacy Information</h3>
        <p>Your data is treated with the utmost security:</p>
        <ul>
          <li>No text is stored after your session ends</li>
          <li>Analysis happens in real-time only</li>
          <li>Your content is not used for AI training</li>
          <li>Zero persistent data retention policy</li>
        </ul>

        <p>For more detail on our privacy practices, please see our <a href="#" target="_blank">Privacy Policy</a>.</p>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="main-footer">
    <div class="footer-container">
      <div class="footer-section brand-section">
        <div class="footer-logo">
          <span>Tone Analysis</span>
        </div>
        <p class="tagline">Open-Source email tone analyzer and AI-powered rewriting assistant. Enhance business
          communication clarity and impact instantly. <span style="font-style: italic;">*Created by Chad
            Wigington.</span></p>
        <div class="social-icons">
          <a href="#" onclick="return false;" aria-label="Facebook">
            <i class="fab fa-facebook-f"></i>
          </a>
          <a href="#" onclick="return false;" aria-label="Twitter/X">
            <i class="fab fa-x-twitter"></i>
          </a>
          <a href="#" onclick="return false;" aria-label="LinkedIn">
            <i class="fab fa-linkedin-in"></i>
          </a>
          <a href="#" onclick="return false;" aria-label="Instagram">
            <i class="fab fa-instagram"></i>
          </a>
        </div>
      </div>

      <div class="footer-section resources">
        <h3>Terms</h3>
        <p>Your text here! Lorem ipsum dolor sit amet, agam altera omittam pri id. Vim habeo inermis deterruisset ex,
          vel in luptatum consetetur, ius instructior consectetuer et. Ut eam tempor habemus, vix minim consequat te.</p>
      </div>
      <div class="footer-section premium">
        <h3>Privacy</h3>
        <p>Your text here! Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
          labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.</p>
      </div>
    </div>

    <div class="sub-footer">
      <div class="sub-footer-container">
        <div class="copyright">
          &copy; <span id="current-year">2025</span>
          <a href="https://www.linkedin.com/in/chadwigington/" target="_blank" rel="noopener noreferrer"
            style="color: #ffffff !important; text-decoration: none; font-weight: 500; transition: opacity 0.2s ease;">
            Chad Wigington
          </a>
          | ToneAnalysis.com. Open-Source Version.
        </div>
        <div class="footer-links">
          <a href="#privacy-policy" onclick="return false;">Privacy Policy</a>
          <a href="#terms-of-service" onclick="return false;">Terms of Service</a>
          <a href="#sitemap" onclick="return false;">Sitemap</a>
          <a href="#contact" onclick="return false;">Contact</a>
        </div>
        <script>
          document.getElementById('current-year').textContent = new Date().getFullYear();
        </script>
      </div>
    </div>
  </footer>


  <!-- Include necessary libraries -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js"></script>
  <script src="secure-js.php?v=2" defer></script>

  <script>
    // This script automatically adds the 'active' class to the current page's navigation link
    document.addEventListener('DOMContentLoaded', function () {
      // Get the current page URL
      const currentLocation = window.location.pathname;

      // Get all navigation links
      const navLinks = document.querySelectorAll('.nav-links a');

      // Loop through each link
      navLinks.forEach(link => {
        // Get the href attribute
        const linkPath = link.getAttribute('href');

        // Check if the current page matches the link
        if (currentLocation.endsWith(linkPath) ||
          (linkPath === '/' && (currentLocation === '/' || currentLocation.endsWith('/index')))) {
          link.classList.add('active');
        }
      });
    });
  </script>
</body>

</html>