/*
 * Part of ToneAnalysis.com project.
 * GitHub: https://github.com/ChadsCode/ToneAnalysis
 * License: MIT Open-Source
 * Website: https://www.toneanalysis.com/
 * Copyright (c) 2025 Chad Wigington
 * LinkedIn: https://www.linkedin.com/in/chadwigington/
 */

// Version check to force refresh if needed
(function() {
  try {
    const currentVersion = '2'; // Match your current version
    const lastVersion = localStorage.getItem('appVersion');

    if (lastVersion && lastVersion !== currentVersion) {
      console.log('App version changed from', lastVersion, 'to', currentVersion);

      // Save version before reload
      localStorage.setItem('appVersion', currentVersion);

      // Force reload
      window.location.reload(true);
    } else {
      // Save current version
      localStorage.setItem('appVersion', currentVersion);
    }
  } catch (error) {
    console.error('Error in version check:', error);
  }
})();

// Document ready event - moved up since we removed PWA code
document.addEventListener("DOMContentLoaded", function() {
  // Global flag for audio context initialization
  window.audioContextInitialized = false;
  // UI Elements
  const textInput = document.getElementById("text-input");
  const fullReport = document.getElementById("full-report");
  const fileInput = document.getElementById("file-input");
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");
  const aboutLink = document.getElementById("about-link");
  const aboutModal = document.getElementById("about-modal");
  const closeModal = document.querySelector(".close-modal");
  const loadingAnimation = document.getElementById("loading-animation");

  // Mode selector variables
  let analysisMode = 'draft'; // Default mode: 'draft', 'email', or 'analyze'
  let lastAnalyzedText = ''; // Store the last analyzed text
  let lastAnalysisResult = null; // Store the last analysis result

  // Verify required elements exist
  if (!textInput) console.error("Element with id 'text-input' not found.");
  if (!fullReport) console.error("Element with id 'full-report' not found.");
  if (!fileInput) console.error("Element with id 'file-input' not found.");

  // Mobile Navigation Toggle
  if (hamburger) {
    hamburger.addEventListener("click", function() {
      hamburger.classList.toggle("active");
      navLinks.classList.toggle("show");
    });
    // Close mobile menu when clicking outside
    document.addEventListener("click", function(event) {
      if (!event.target.closest(".hamburger") && !event.target.closest(".nav-links") && navLinks.classList.contains("show")) {
        hamburger.classList.remove("active");
        navLinks.classList.remove("show");
      }
    });
  }

  // Extension button click handler
  const extensionBadge = document.querySelector('.extension-badge');
  if (extensionBadge) {
    extensionBadge.addEventListener('click', function(e) {
      // Remove e.preventDefault();
      window.location.href = this.getAttribute('href'); // Use the original href
    });
  }

  // Tab switching functionality for mode selection
  const modeTabs = document.querySelectorAll('.mode-tab');
  if (modeTabs.length > 0) {
    modeTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // First update active visual state
        modeTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');

        // Then update the mode variable
        analysisMode = this.getAttribute('data-mode');


        // Update button text based on mode
        const runAnalysisBtn = document.getElementById('run-analysis-btn');
        if (runAnalysisBtn) {
          if (analysisMode === 'analyze') {
            runAnalysisBtn.innerHTML = '<i class="fas fa-analytics"></i> Run Analysis';
          } else if (analysisMode === 'draft') {
            runAnalysisBtn.innerHTML = '<i class="fas fa-magic"></i> Improve Draft';
          } else {
            runAnalysisBtn.innerHTML = '<i class="fas fa-envelope"></i> Generate Response';
          }
        }

        // Update textarea placeholder based on the current mode
        updatePlaceholderText();
      });
    });
  }

  // Audio Recording Variables
  let mediaRecorder;
  let audioChunks = [];
  let recordingTimer;
  let recordingDuration = 0;
  const MAX_RECORDING_TIME = 60; // Default 1 minute
  let isRecording = false;
  // Timing variables for rate limit management
  let lastTextAnalysisTime = 0;
  let lastAudioProcessingTime = 0;
  const TEXT_ANALYSIS_COOLDOWN = 5000; // 5 seconds between text analyses
  const AUDIO_PROCESSING_COOLDOWN = 5000; // 5 seconds between audio processing

  // Add these variables for audio-specific cooldowns
  let audioCooldownActive = false;
  let audioCooldownTimer = null;
  let audioCooldownSeconds = 0;
  // Tab switching functionality
  const uploadButton = document.querySelector('.tab-btn[data-tab="upload"]');
  const recordButton = document.getElementById('record-btn');
  const recordingTimeDisplay = document.getElementById('recording-time');
  const maxRecordingTimeDisplay = document.getElementById('max-recording-time');
  // Set max recording time display
  if (maxRecordingTimeDisplay) {
    maxRecordingTimeDisplay.textContent = formatTime(MAX_RECORDING_TIME);
  }
  // Upload button click handler
  if (uploadButton) {
    uploadButton.addEventListener('click', function() {
      fileInput.click();
    });
  }
  // Helper function to format time
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Helper function to update textarea placeholder based on current mode
  function updatePlaceholderText() {
    if (textInput) {
      switch (analysisMode) {
        case 'draft':
          textInput.placeholder = "Enter draft email or use Record to dictate.";
          break;
        case 'email':
          textInput.placeholder = "Paste received email here. I'll generate responses.";
          break;
        case 'analyze':
          textInput.placeholder = "Paste text to analyze tone and emotions. Use Record for dictation.";
          break;
        default:
          textInput.placeholder = "Add text for tone analysis. Use Record for speech input.";
      }
    }
  }

  // Add browser detection function
  function detectBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();

    // iOS detection
    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'ios';
    }

    // Mac Safari detection 
    if (/^((?!chrome|android).)*safari/i.test(userAgent) && /Mac/.test(navigator.platform)) {
      return 'safari';
    }

    if (userAgent.includes('firefox')) return 'firefox';
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) return 'chrome';
    if (userAgent.includes('edg')) return 'edge';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'safari';
    if (userAgent.includes('duckduckgo')) return 'duckduckgo';
    return 'unknown';
  }

  // Initialize audio recording (UPDATED FOR iOS)
  async function initializeAudioRecording() {
    try {
      // Browser-specific audio constraints
      const browser = detectBrowser();
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const isMacSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && /Mac/.test(navigator.platform);

      // iOS-specific constraints
      const constraints = {
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Use different sampling rates based on the browser
          sampleRate: browser === 'chrome' || browser === 'edge' || browser === 'duckduckgo' ? 16000 : 44100
        }
      };

      // If on iOS, simplify the constraints
      if (isIOS || isMacSafari) {
        constraints.audio = true; // Use simple constraints for iOS
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Try different mime types based on browser
      let mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/wav'
      ];

      // For iOS/Safari, prioritize different formats
      if (isIOS || isMacSafari) {
        mimeTypes = [
          'audio/mp4',
          'audio/aac',
          'audio/wav'
        ];
      }

      let selectedMimeType = null;

      // Find supported mime type
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      // Fallback for iOS/Safari which may not report codec support correctly
      if (!selectedMimeType) {
        if (isIOS || isMacSafari) {
          selectedMimeType = 'audio/mp4'; // Default fallback for iOS
        } else if (/Android/.test(navigator.userAgent)) {
          selectedMimeType = 'audio/webm'; // Default fallback for Android
        } else {
          selectedMimeType = 'audio/wav'; // General fallback
        }
      }

      // Create MediaRecorder with appropriate options
      const options = {
        mimeType: selectedMimeType
      };

      // iOS/Safari may need a lower bitrate
      if (isIOS || isMacSafari) {
        options.audioBitsPerSecond = 128000;
      }

      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      // Store the original onstop handler
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, {
          type: selectedMimeType
        });
        await processAudioRecording(audioBlob);
        audioChunks = [];
      };

      return true;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showNotification('Microphone access denied. Please enable microphone access to use recording.', 'error');
      resetRecordButton();
      return false;
    }
  }

  // Add WAV conversion function
  async function convertToWav(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const audioContext = new(window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(reader.result);

          // Create WAV data
          const wavData = audioBufferToWav(audioBuffer);
          const wavBlob = new Blob([wavData], {
            type: 'audio/wav'
          });
          resolve(wavBlob);
        } catch (error) {
          console.error('Conversion error:', error);
          resolve(blob); // Fallback to original blob
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  // Add WAV encoder function
  function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    let offset = 0;
    let pos = 0;

    // Write WAVE header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length - pos - 4, true);

    // Define channels array
    const channels = [];

    // Write audio data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    offset = 0;
    pos = 44;
    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return bufferArray;
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Process recorded audio
  async function processAudioRecording(audioBlob) {
    // Add timing check at the beginning
    const now = Date.now();
    const timeSinceLastAudio = now - lastAudioProcessingTime;

    if (timeSinceLastAudio < AUDIO_PROCESSING_COOLDOWN) {
      const waitTime = Math.ceil((AUDIO_PROCESSING_COOLDOWN - timeSinceLastAudio) / 1000);
      showNotification(`Please wait ${waitTime} seconds before processing more audio.`, 'warning');
      return;
    }

    lastAudioProcessingTime = now;

    showNotification('Processing your audio recording...', 'info');
    loadingAnimation.style.display = 'flex';

    try {
      let finalBlob = audioBlob;
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const isMacSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && /Mac/.test(navigator.platform);

      // Only convert if needed and not on iOS/Safari (they use different formats)
      if (audioBlob.type !== 'audio/wav' && !isIOS && !isMacSafari) {
        finalBlob = await convertToWav(audioBlob);
      }

      const formData = new FormData();
      formData.append('audio', finalBlob, 'recording.' + (isIOS || isMacSafari ? 'mp4' : 'wav'));
      formData.append('browser', detectBrowser());

      await fetch('/speech-to-text.php', {
          method: 'POST',
          body: formData
        })
        // Rest of your function remains the same
        .then(response => {
          if (!response.ok) {
            if (response.status === 429) {
              const retrySeconds = 5;
              startAudioCooldown(retrySeconds);
              throw new Error(`Rate limit exceeded. Please try again in ${retrySeconds} seconds.`);
            }
            throw new Error(`Server error: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.error) {
            throw new Error(data.error);
          }

          if (data.text) {
            textInput.value = data.text;
            textInput.dispatchEvent(new Event('input'));
            showNotification('Audio converted successfully!', 'success');
          } else {
            throw new Error('No text detected in audio');
          }
        })
        .catch(error => {
          console.error('Error processing audio:', error);

          if (error.message.includes('Rate limit exceeded')) {
            showNotification(error.message, 'warning');
          } else {
            showNotification('Failed to process audio. Please try again.', 'error');
          }
        })
        .finally(() => {
          loadingAnimation.style.display = 'none';
          resetRecordButton();
        });

    } catch (error) {
      console.error('Unexpected error:', error);
      showNotification('Unexpected error occurred. Please try again.', 'error');
      loadingAnimation.style.display = 'none';
      resetRecordButton();
    }
  }

  // Start recording
  async function startRecording() {
    // Check audio-specific cooldown
    if (audioCooldownActive) {
      showNotification(`Please wait ${audioCooldownSeconds} seconds before recording more audio.`, 'warning');
      return;
    }

    try {
      // Fix for iOS: Create audio context on user interaction
      if (!window.audioContextInitialized) {
        try {
          // Create temporary audio context to initialize audio system
          const tempAudioContext = new(window.AudioContext || window.webkitAudioContext)();
          tempAudioContext.resume().then(() => {
            window.audioContextInitialized = true;
            // Close it immediately to free resources
            setTimeout(() => tempAudioContext.close(), 100);
          });
        } catch (e) {
          console.warn('Could not initialize AudioContext:', e);
        }
      }

      if (mediaRecorder) {
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        mediaRecorder = null;
      }

      const initialized = await initializeAudioRecording();
      if (!initialized) return;

      audioChunks = [];

      if (mediaRecorder.state === 'inactive') {
        const browser = detectBrowser();
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isMacSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && /Mac/.test(navigator.platform);

        // Use different timeslice settings based on platform
        let timeslice;
        if (browser === 'firefox') {
          timeslice = 1000;
        } else if (isIOS || isMacSafari) {
          timeslice = 500; // More frequent chunks for iOS/Safari
        } else {
          timeslice = undefined;
        }

        mediaRecorder.start(timeslice);
        isRecording = true;

        // Update button UI for recording state
        recordButton.classList.add('recording');
        recordButton.querySelector('.record-icon').classList.replace('fa-microphone', 'fa-stop');
        recordButton.querySelector('.record-text').textContent = 'Stop';

        recordingDuration = 0;
        recordingTimeDisplay.textContent = formatTime(0);

        recordingTimer = setInterval(() => {
          recordingDuration++;
          recordingTimeDisplay.textContent = formatTime(recordingDuration);

          if (recordingDuration >= MAX_RECORDING_TIME) {
            stopRecording();
          }
        }, 1000);
      } else {
        throw new Error('MediaRecorder not in inactive state');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      showNotification('Failed to start recording. Please try again.', 'error');
      mediaRecorder = null;
      isRecording = false;
      clearInterval(recordingTimer);
      resetRecordButton();
    }
  }

  // Stop recording
  function stopRecording() {
    if (mediaRecorder && isRecording) {
      try {
        mediaRecorder.stop();
        clearInterval(recordingTimer);
        isRecording = false;

        // Update button UI for processing state
        recordButton.classList.remove('recording');
        recordButton.classList.add('processing');
        recordButton.querySelector('.record-icon').classList.replace('fa-stop', 'fa-spinner');
        recordButton.querySelector('.record-text').textContent = 'Wait';
        recordButton.disabled = true;
      } catch (error) {
        console.error('Error stopping recording:', error);
        clearInterval(recordingTimer);
        isRecording = false;
        if (mediaRecorder && mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorder = null;
        resetRecordButton();
      }
    }
  }

  function resetRecordButton() {
    recordButton.classList.remove('recording', 'processing');
    recordButton.querySelector('.record-icon').classList.remove('fa-stop', 'fa-spinner');
    recordButton.querySelector('.record-icon').classList.add('fa-microphone');
    recordButton.querySelector('.record-text').textContent = 'Record';
    recordButton.disabled = false;
  }

  // Record button click handler
  if (recordButton) {
    recordButton.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }

  // About Modal
  if (aboutLink && aboutModal && closeModal) {
    aboutLink.addEventListener("click", function(e) {
      e.preventDefault();
      aboutModal.classList.add("show");
      document.body.style.overflow = "hidden";
    });

    closeModal.addEventListener("click", function() {
      aboutModal.classList.remove("show");
      document.body.style.overflow = "";
    });

    // Close modal on outside click
    window.addEventListener("click", function(event) {
      if (event.target === aboutModal) {
        aboutModal.classList.remove("show");
        document.body.style.overflow = "";
      }
    });

    // Close modal on Escape key
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape" && aboutModal.classList.contains("show")) {
        aboutModal.classList.remove("show");
        document.body.style.overflow = "";
      }
    });
  }

  // Smooth scrolling for internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      if (this.getAttribute('href') !== "#") {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });

  // FIX: Don't immediately call fileInput.click() as it will trigger automatically
  // Only attach event handlers to the upload button
  if (uploadButton && fileInput) {
    // Event handlers are attached elsewhere
  } else {
    console.error("Upload button or file input not found.");
  }

  // Initialize placeholder text based on default mode (draft)
  updatePlaceholderText();

  // Add file input change event listener
  if (fileInput) {
    fileInput.addEventListener("change", function(e) {
      const file = this.files[0];
      if (file) {
        handleFileUpload(file);
      }
    });
  }

  function handleFileUpload(file) {
    const fileName = file.name.toLowerCase();
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.webm'];

    // Check if it's an audio file
    if (audioExtensions.some(ext => fileName.endsWith(ext))) {
      processAudioFile(file);
    } else {
      processTextFile(file);
    }
  }

  function processAudioFile(file) {
    const MAX_AUDIO_SIZE = 10485760; // 10MB limit for audio files

    if (file.size > MAX_AUDIO_SIZE) {
      showNotification('Audio file exceeds 10MB limit. Please upload a smaller file.', 'error');
      return;
    }

    showNotification('Processing your audio file...', 'info');
    loadingAnimation.style.display = 'flex';

    const formData = new FormData();
    formData.append('audio', file);

    fetch('/speech-to-text.php', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          if (response.status === 429) {
            const retrySeconds = 5;
            startAudioCooldown(retrySeconds);
            throw new Error(`Rate limit exceeded. Please try again in ${retrySeconds} seconds.`);
          }
          throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }

        if (data.text) {
          textInput.value = data.text;
          textInput.dispatchEvent(new Event('input'));
          showNotification('Audio converted successfully!', 'success');
        } else {
          throw new Error('No text detected in audio');
        }
      })
      .catch(error => {
        console.error('Error processing audio:', error);

        if (error.message.includes('Rate limit exceeded')) {
          showNotification(error.message, 'warning');
        } else {
          showNotification('Failed to process audio. Please try again.', 'error');
        }
      })
      .finally(() => {
        loadingAnimation.style.display = 'none';
        resetRecordButton();
      });
  }

  function processTextFile(file) {
    const MAX_FILE_SIZE = 409600; // 400 KB ~ 20 pages

    if (file.size > MAX_FILE_SIZE) {
      showNotification("File exceeds the size limit (approx. 20 pages). Please upload a smaller document.", "error");
      return;
    }

    showNotification("Processing your file...", "info");

    if (file.name.toLowerCase().endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = function(e) {
        textInput.value = e.target.result;
        showNotification("Text file loaded successfully!", "success");
        textInput.dispatchEvent(new Event('input'));
      };
      reader.onerror = function() {
        showNotification("Failed to read text file.", "error");
        fileInput.value = "";
      };
      reader.readAsText(file);
    } else if (file.name.toLowerCase().endsWith(".pdf")) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const typedArray = new Uint8Array(e.target.result);
        pdfjsLib.getDocument(typedArray).promise.then(function(pdf) {
          pdf.getPage(1).then(function(page) {
            const scale = 1.5;
            const viewport = page.getViewport({
              scale
            });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            page.render(renderContext).promise.then(function() {
              const imageData = canvas.toDataURL();
              pdfjsLib.reconstitutePDFWorker().then(() => {
                showNotification("PDF file loaded successfully!", "success");
              });
            });
          });
        }, function(reason) {
          showNotification("Failed to read PDF file.", "error");
          fileInput.value = "";
        });
      };
      reader.onerror = function() {
        showNotification("Failed to read PDF file.", "error");
        fileInput.value = "";
      };
      reader.readAsArrayBuffer(file);
    } else if (file.name.toLowerCase().endsWith(".doc") || file.name.toLowerCase().endsWith(".docx")) {
      mammoth.extractRawText({
        arrayBuffer: file
      }).then(function(resultObject) {
        textInput.value = resultObject.value;
        showNotification("Word file loaded successfully!", "success");
      }).catch(function(error) {
        showNotification("Failed to read Word file.", "error");
        fileInput.value = "";
      }).done();
    } else {
      showNotification("File type not supported. Currently, only plain text (.txt), PDF (.pdf), Word (.doc/.docx), and audio (.mp3, .wav, .m4a, .ogg, .webm) files can be processed.", "error");
      fileInput.value = "";
    }
  }

  // Request queue system to prevent rapid requests
  const RequestQueue = {
    queue: [],
    processing: false,

    add(request) {
      this.queue.push(request);
      if (!this.processing) {
        this.process();
      }
    },

    async process() {
      if (this.queue.length === 0) {
        this.processing = false;
        return;
      }

      this.processing = true;
      const request = this.queue.shift();

      try {
        await request();
      } catch (error) {
        console.error('Queue processing error:', error);
      }

      // Wait 1 second between requests
      setTimeout(() => {
        this.processing = false;
        this.process();
      }, 1000);
    }
  };

  // Get Run Analysis and Refresh buttons
  const runAnalysisBtn = document.getElementById("run-analysis-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  if (!runAnalysisBtn) console.error("Element with id 'run-analysis-btn' not found. Please verify your HTML.");
  if (!refreshBtn) console.error("Element with id 'refresh-btn' not found. Please verify your HTML.");

  // --- ENHANCEMENT: Create word limit notice ---
  const wordLimitNoticeContainer = document.createElement('div');
  wordLimitNoticeContainer.className = 'word-limit-notice';
  wordLimitNoticeContainer.style.display = 'none';
  wordLimitNoticeContainer.innerHTML = '<span>500 word maximum</span>';
  document.querySelector('.textarea-wrapper').appendChild(wordLimitNoticeContainer);

  // --- ENHANCEMENT: Create cooldown notice ---
  const cooldownNoticeContainer = document.createElement('div');
  cooldownNoticeContainer.className = 'cooldown-notice';
  cooldownNoticeContainer.style.display = 'none';
  cooldownNoticeContainer.innerHTML = '<div class="cooldown-indicator"></div><span>Please wait <span id="cooldown-seconds">10</span> seconds before next analysis</span>';
  document.querySelector('.button-container').appendChild(cooldownNoticeContainer);

  // --- ENHANCEMENT: Add word counter for text input ---
  const wordCountContainer = document.createElement('div');
  wordCountContainer.className = 'word-count';
  wordCountContainer.innerHTML = '<span id="current-word-count">0</span> / 500';
  document.querySelector('.textarea-wrapper').appendChild(wordCountContainer);

  // --- ENHANCEMENT: Monitor input for word count ---
  textInput.addEventListener('input', function() {
    const text = this.value.trim();
    const wordCount = text ? text.split(/\s+/).length : 0;
    const wordCountElement = document.getElementById('current-word-count');

    if (wordCountElement) {
      wordCountElement.textContent = wordCount;
      wordCountElement.style.color = wordCount > 500 ? '#e74c3c' : '#666';
    }

    // Show or hide word limit notice
    wordLimitNoticeContainer.style.display = wordCount > 500 ? 'flex' : 'none';

    // Disable or enable run button based on word count
    if (runAnalysisBtn) {
      if (wordCount > 500) {
        runAnalysisBtn.disabled = true;
        runAnalysisBtn.classList.add('disabled');
      } else {
        runAnalysisBtn.disabled = false;
        runAnalysisBtn.classList.remove('disabled');
      }
    }
  });

  // --- ENHANCEMENT: Functions to handle cooldown period ---
  let cooldownActive = false;
  let cooldownTimer = null;
  let cooldownSeconds = 0; // Will be set randomly

  // Add these functions for audio cooldown
  function startAudioCooldown(seconds = 5) {
    audioCooldownActive = true;
    audioCooldownSeconds = seconds;
    updateAudioCooldownDisplay();

    audioCooldownTimer = setInterval(() => {
      audioCooldownSeconds--;
      updateAudioCooldownDisplay();

      if (audioCooldownSeconds <= 0) {
        endAudioCooldown();
      }
    }, 1000);
  }

  function endAudioCooldown() {
    audioCooldownActive = false;
    clearInterval(audioCooldownTimer);
    audioCooldownSeconds = 0;
  }

  function updateAudioCooldownDisplay() {
    // Optional: You can add a visual indicator for audio cooldown if needed
    console.log(`Audio cooldown: ${audioCooldownSeconds} seconds remaining`);
  }

  function startCooldown() {
    cooldownActive = true;
    // Use a fixed cooldown instead of random
    cooldownSeconds = 5; // Fixed 5 seconds cooldown

    updateCooldownDisplay();

    if (runAnalysisBtn) {
      runAnalysisBtn.disabled = true;
      runAnalysisBtn.classList.add('disabled');
    }

    cooldownNoticeContainer.style.display = 'flex';

    cooldownTimer = setInterval(() => {
      cooldownSeconds--;
      updateCooldownDisplay();

      if (cooldownSeconds <= 0) {
        endCooldown();
      }
    }, 1000);

    // Store cooldown end time in localStorage
    const cooldownEndTime = Date.now() + (cooldownSeconds * 1000);
    localStorage.setItem('cooldownEndTime', cooldownEndTime.toString());
  }

  function updateCooldownDisplay() {
    const secondsElement = document.getElementById('cooldown-seconds');
    if (secondsElement) {
      secondsElement.textContent = cooldownSeconds;
    }
  }

  function endCooldown() {
    cooldownActive = false;
    clearInterval(cooldownTimer);

    if (runAnalysisBtn) {
      // Check if there's still a word count issue
      const wordCount = textInput.value.trim() ? textInput.value.trim().split(/\s+/).length : 0;
      if (wordCount <= 500) {
        runAnalysisBtn.disabled = false;
        runAnalysisBtn.classList.remove('disabled');
      }
    }

    cooldownNoticeContainer.style.display = 'none';
    localStorage.removeItem('cooldownEndTime');
  }

  // Check if there's an existing cooldown when the page loads
  function checkExistingCooldown() {
    const cooldownEndTime = localStorage.getItem('cooldownEndTime');
    if (cooldownEndTime) {
      const timeRemaining = parseInt(cooldownEndTime) - Date.now();
      if (timeRemaining > 0) {
        // Resume cooldown with the remaining time
        cooldownActive = true;
        cooldownSeconds = Math.ceil(timeRemaining / 1000);
        updateCooldownDisplay();

        if (runAnalysisBtn) {
          runAnalysisBtn.disabled = true;
          runAnalysisBtn.classList.add('disabled');
        }

        cooldownNoticeContainer.style.display = 'flex';

        cooldownTimer = setInterval(() => {
          cooldownSeconds--;
          updateCooldownDisplay();

          if (cooldownSeconds <= 0) {
            endCooldown();
          }
        }, 1000);
      } else {
        // Cooldown has already expired
        localStorage.removeItem('cooldownEndTime');
      }
    }
  }
  checkExistingCooldown();

  // --- ENHANCEMENT: Updated daily limit constants ---
  const DAILY_LIMIT = 100; // Reduced to 3 calls per day as requested

  // --- ENHANCEMENT: Use browser fingerprinting for better tracking ---
  async function generateClientId() {
    // Create a simple fingerprint based on browser and device info
    const userAgent = navigator.userAgent;
    const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    const timezoneOffset = new Date().getTimezoneOffset();
    const language = navigator.language;
    const fingerprint = `${userAgent}|${screenInfo}|${timezoneOffset}|${language}`;

    // Create a hash of the fingerprint
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  // Get or create client ID
  let clientId;
  async function getClientId() {
    if (!clientId) {
      // Try to get from localStorage first
      clientId = localStorage.getItem('clientId');
      if (!clientId) {
        // Generate new client ID if none exists
        clientId = await generateClientId();
        localStorage.setItem('clientId', clientId);
      }
    }
    return clientId;
  }

  // Initialize client ID on page load
  getClientId();

  function resetUsageCountIfNewDay() {
    const lastReset = localStorage.getItem("lastResetDate");
    const today = new Date().toLocaleDateString();
    if (lastReset !== today) {
      localStorage.setItem("usageCount", "0");
      localStorage.setItem("lastResetDate", today);

      // Also store in sessionStorage as a backup tracking mechanism
      sessionStorage.setItem("usageCount", "0");
      sessionStorage.setItem("lastResetDate", today);
    }
  }
  resetUsageCountIfNewDay();

  async function getUsageCount() {
    const clientId = await getClientId();
    const usageKey = `usageCount_${clientId}`;

    // Try to get from localStorage first
    let count = parseInt(localStorage.getItem(usageKey) || "0", 10);

    // Fallback to the general usageCount if client-specific count is not found
    if (isNaN(count)) {
      count = parseInt(localStorage.getItem("usageCount") || "0", 10);
    }

    // Extra validation with sessionStorage as a backup
    const sessionCount = parseInt(sessionStorage.getItem("usageCount") || "0", 10);

    // Return the highest count between localStorage and sessionStorage to prevent bypassing
    return Math.max(count, sessionCount);
  }

  async function incrementUsageCount() {
    const clientId = await getClientId();
    const usageKey = `usageCount_${clientId}`;

    const currentCount = await getUsageCount();
    localStorage.setItem(usageKey, (currentCount + 1).toString());
    localStorage.setItem("usageCount", (currentCount + 1).toString());

    // Also update sessionStorage as a backup
    sessionStorage.setItem("usageCount", (currentCount + 1).toString());
  }

  // ---- ADD NEW EMAIL RESPONSE MODE ----
  // These variables may already be declared, so don't use 'let' again
  // Just assign values to maintain the intended functionality
  analysisMode = analysisMode || 'draft'; // Default mode: 'draft' is the default to match HTML
  lastAnalyzedText = lastAnalyzedText || ''; // Store the last analyzed text
  lastAnalysisResult = lastAnalysisResult || null; // Store the last analysis result
  let emailToneChangeCount = 0; // Count of tone changes for the current email
  const MAX_TONE_CHANGES = 5; // Define the max number of tone changes allowed

  // Don't remove the existing HTML mode selectors - work with them instead
  (function() {
    // Get existing mode tabs from HTML
    const modeTabs = document.querySelectorAll('.mode-tab');

    // Find the currently active tab and set the initial mode
    modeTabs.forEach(tab => {
      if (tab.classList.contains('active')) {
        analysisMode = tab.getAttribute('data-mode');
      }

      // Add event listeners to each tab
      tab.addEventListener('click', function() {
        // First update active visual state
        modeTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');

        // Then update the mode variable
        analysisMode = this.getAttribute('data-mode');

        // Update button text based on mode
        const runAnalysisBtn = document.getElementById('run-analysis-btn');
        if (runAnalysisBtn) {
          if (analysisMode === 'analyze') {
            runAnalysisBtn.innerHTML = '<i class="fas fa-analytics"></i> Run Analysis';
          } else if (analysisMode === 'draft') {
            runAnalysisBtn.innerHTML = '<i class="fas fa-magic"></i> Improve Draft';
          } else {
            runAnalysisBtn.innerHTML = '<i class="fas fa-envelope"></i> Generate Response';
          }
        }

        // Update textarea placeholder based on mode
        const textInput = document.getElementById('text-input');
        if (textInput) {
          if (analysisMode === 'draft') {
            textInput.placeholder = "Write a short prompt and we'll generate a full professional email...";
          } else if (analysisMode === 'email') {
            textInput.placeholder = "Paste an email you received. We'll rewrite a professional response...";
          } else if (analysisMode === 'analyze') {
            textInput.placeholder = "Paste any message or email to analyze tone, sentiment, and compliance...";
          }
        }
      });
    });

    // Initialize placeholder text based on the active tab
    const activeTab = document.querySelector('.mode-tab.active');
    if (activeTab) {
      const mode = activeTab.getAttribute('data-mode');
      const textInput = document.getElementById('text-input');

      if (textInput) {
        if (mode === 'draft') {
          textInput.placeholder = "Write or paste a draft email. We'll proofread or enhance it.";
        } else if (mode === 'email') {
          textInput.placeholder = "Paste an email you received. We'll generate a response.";
        } else if (mode === 'analyze') {
          textInput.placeholder = "Paste any message or email to analyze tone and sentiment.";
        }
      }

      // Initialize button text
      const runAnalysisBtn = document.getElementById('run-analysis-btn');
      if (runAnalysisBtn) {
        if (mode === 'analyze') {
          runAnalysisBtn.innerHTML = '<i class="fas fa-analytics"></i> Run Analysis';
        } else if (mode === 'draft') {
          runAnalysisBtn.innerHTML = '<i class="fas fa-magic"></i> Improve Draft';
        } else {
          runAnalysisBtn.innerHTML = '<i class="fas fa-envelope"></i> Generate Response';
        }
      }
    }
  });

  // Add ToneSafeguard function to filter inappropriate content
  const ToneSafeguard = {
    // List of terms to check for inappropriate content
    // Extend this list based on your moderation needs
    inappropriatePatterns: [
      /\b(fuck|shit|ass|bitch|cunt|damn|dick|cock|pussy|whore|slut)\b/i,
      /\b(kill|suicide|die|death|murder|hanging|shoot)\b.*\b(yourself|myself|themselves|himself|herself)\b/i,
      /\b(racist|nazi|hitler|supremac|genocide)\b/i
    ],

    // Check if text contains inappropriate content
    checkContent(text) {
      for (const pattern of this.inappropriatePatterns) {
        if (pattern.test(text)) {
          return true; // Contains inappropriate content
        }
      }
      return false; // Safe content
    },

    // Filter inappropriate content (fallback message if needed)
    filterContent(text) {
      if (this.checkContent(text)) {
        return "I cannot generate that response as it may contain inappropriate content. Please review your request and try again with more professional language.";
      }
      return text; // Return original if safe
    }
  };

  // Helper function to get tone description
  function getToneDescription(toneType) {
    const toneDescriptions = {
      'formal': 'Highly structured, proper language, no contractions or slang, respectful addresses, use of full titles, avoids personal anecdotes, maintains distance and authoritative voice.',
      'professional': 'Clear, direct, and efficient language. Respectful but not overly formal. Uses some contractions, focuses on facts and solutions, polite but straight to the point.',
      'casual': 'Relaxed language with contractions, some slang (but still professional), uses first names, includes some personal touches, more conversational flow, friendly tone.',
      'friendly': 'Warm and personable, uses encouraging language, personal anecdotes where appropriate, expresses empathy, conversational style with questions, shows genuine care and interest.'
    };

    return toneDescriptions[toneType] || toneDescriptions['professional'];
  }

  // Generate tone-specific email draft from a short prompt
  async function generateEmailDraft(toneType = 'proofread', prompt) {
    if (!prompt || prompt.length < 2) {
      showNotification('Please provide a more detailed prompt for generating an email.', 'warning');
      return;
    }

    // Check if we've exceeded the tone change limit
    if (emailToneChangeCount >= MAX_TONE_CHANGES) {
      showNotification(`You've reached the maximum of ${MAX_TONE_CHANGES} tone changes for this email.`, 'warning');
      return;
    }

    // Show loading indication only for the email response area
    const existingEmailResponse = document.getElementById('email-response-container');
    if (existingEmailResponse) {
      existingEmailResponse.innerHTML = `
      <div class="email-response-loading">
        <div class="loading-spinner"></div>
        <p>Generating ${toneType} email draft...</p>
      </div>
    `;
    }

    try {
      // Create prompt for generating email from short prompt
      let systemPrompt = '';

      if (toneType === 'proofread') {
        systemPrompt = `You are a professional proofreader AI. Follow these instructions strictly:

1. ONLY correct:
   - Spelling mistakes
   - Grammar and punctuation errors
   - Awkward sentence structure (only if needed for clarity)

2. DO NOT:
   - Add, remove, or rephrase content
   - Change tone, format, or style
   - Summarize, explain, label, or formalize anything
   - Output more than one sentence or paragraph

3. Output MUST:
   - Match the input's sentence count and structure
   - Preserve slang, contractions, and natural tone
   - Return only the corrected sentence — nothing more

4. Use NLP to detect and mirror the user's natural tone, formality, and phrasing.

If the input is quoted (e.g., starts with a quote), treat it as locked. Return ONLY a technically corrected version, still in quotes. Do NOT expand or rephrase it as an email or message. Return no metadata.

If the user input is a single sentence or paragraph, return ONLY that corrected version. Do NOT reformat it as an email, greeting, message, or letter. DO NOT expand, rewrite, rephrase, or formalize the user's tone in any way. If the input starts with a quote ("), return the corrected version still wrapped in quotes.
Never include inappropriate, offensive, harmful language, profanity, hate speech, slurs, and defamatory content.`;
      } else if (toneType === 'professional') {
        systemPrompt = `You are a professional proofreader AI and business tone refiner. Follow these rules strictly:

1. ONLY correct:
   - Spelling mistakes
   - Grammar and punctuation errors
   - Awkward sentence structure (only if needed for clarity)

2. DO NOT:
   - Add, remove, or rephrase content beyond correction
   - Change meaning, summarize, or label
   - Output multiple sentences or paragraphs

3. Output MUST:
   - Match the input structure and approximate length
   - Preserve user intent
   - Return only the corrected version (no extra text or labels)

4. Censor all profanity, hate speech, slurs, and defamatory content:
   - Replace offensive words with "****"

5. Use NLP to detect and mirror the user's natural tone

6. Apply THIS strict tone profile:
   - Interdependent (30% Independent, 70% Interdependent)
   - Slightly Status-oriented (30/70)
   - Certainty-seeking (20/80 Risk/Certainty)
   - Direct (80% Direct, 20% Indirect)
   - Balanced Task/Relationship (60/40)

Your job is to proofread and rewrite ONLY to match this exact business tone.`;
      } else if (toneType === 'formal') {
        systemPrompt = `You are a professional proofreader AI. Follow these rules strictly:

1. ONLY correct:
   - Spelling, grammar, punctuation, awkward phrasing

2. DO NOT:
   - Add, rephrase, summarize, explain
   - Output more than one sentence or paragraph

3. Output MUST:
   - Match input structure and preserve meaning
   - Be corrected AND rewritten into a formal tone:
     - Avoid contractions
     - Use precise, respectful, academic/business language
     - Remove slang or casual expressions

4. Censor all profanity, hate speech, or slurs with "****"

5. Use NLP to respect the user's original format and intent.`;
      } else if (toneType === 'casual') {
        systemPrompt = `You are a proofreader AI. Follow these rules:

1. Correct spelling, grammar, punctuation, and sentence structure
2. DO NOT rephrase or explain
3. Maintain a relaxed, natural tone:
   - Use contractions
   - Keep language informal
   - Allow light phrasing/slang when appropriate

4. Censor profanity or offensive content with "****"
5. Use NLP to preserve user's casual writing style.`;
      } else if (toneType === 'friendly') {
        systemPrompt = `You are a proofreader AI trained to add warmth to your corrections. Follow these rules:

1. Correct grammar, punctuation, and structure as needed
2. Keep the tone light, empathetic, and caring
3. Use friendly, supportive phrasing
4. NEVER rephrase intent — preserve user's message and meaning
5. Censor harmful language with "****"
6. Output only a single, corrected, friendly-sounding version`;
      } else {
        systemPrompt = `You are an expert email writer.
  Create a complete, professional email based on this short prompt or request.
  
  The email should be in a ${toneType} tone, which means:
  ${getToneDescription(toneType)}
  
  The email should:
  1. Have a clear, relevant subject line (marked with "Subject:")
  2. Begin with an appropriate greeting
  3. Have a well-structured body with proper paragraphs
  4. End with an appropriate signature line
  5. Be complete, professional, and ready to send
  
  Do not include placeholder text or ask for more information.
  Make reasonable assumptions based on the prompt.
  Always maintain a constructive and positive approach.
  Never include inappropriate, offensive, or harmful language.`;
      }

      // Create user message with the prompt
      let userMessage = '';
      if (toneType === 'proofread') {
        userMessage = `Proofread the following EXACTLY as written, making only technical corrections:

"${prompt}"

Return ONLY the corrected text with no additional formatting or content.`;
      } else {
        userMessage = `Generate a complete ${toneType} email based on this request or prompt:

"${prompt}"

Analyze the tone and sentiment of this prompt to determine the appropriate subject line, greeting, and closing.
Start with "Suggested Subject:" and then write the full email with an appropriate greeting and closing.`;
      }

      // Request generation from OpenAI
      const response = await fetch("/openai.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          model: "gpt-4-turbo",
          messages: [{
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          temperature: 0.7 // Balanced creativity
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // Only increment counter if this isn't the first generation
      if (document.querySelector('.email-tone-selector')) {
        emailToneChangeCount++;
      }

      // Process the response text
      let emailText = data.choices[0].message.content.trim();

      // Word count guardrail - Anti-hallucination
      const inputWords = prompt ? prompt.trim().split(/\s+/).length : 0;
      const outputWords = emailText.split(/\s+/).length;
      if (Math.abs(inputWords - outputWords) > 2) {
        console.warn(`⚠️ Potential hallucination in ${toneType} tone — output deviated in word count.`);
        // You may want to handle this case differently if needed
      }

      // Apply safety filter
      emailText = ToneSafeguard.filterContent(emailText);

      // Check if email response container exists, update it or create it
      if (existingEmailResponse) {
        createEmailResponseContent(existingEmailResponse, emailText, toneType);
      } else {
        createEmailResponseContainer(emailText, toneType);
      }

    } catch (error) {
      console.error("Error generating email draft:", error);
      showNotification('Failed to generate email draft. Please try again.', 'error');

      // Remove loading state if there was an error
      const existingEmailResponse = document.getElementById('email-response-container');
      if (existingEmailResponse && existingEmailResponse.querySelector('.email-response-loading')) {
        existingEmailResponse.innerHTML = `
          <div class="email-response-error">
            <p>Error generating email draft. Please try again.</p>
          </div>
        `;
      }
    }
  }

  // Generate tone-specific email response
  async function generateEmailResponse(toneType = 'professional', mode = 'email') {
    if (!lastAnalysisResult) {
      showNotification('Please run an analysis first before generating an email response.', 'warning');
      return;
    }

    // Check if we've exceeded the tone change limit
    if (emailToneChangeCount >= MAX_TONE_CHANGES) {
      showNotification(`You've reached the maximum of ${MAX_TONE_CHANGES} tone changes for this email.`, 'warning');
      return;
    }

    // Show loading indication only for the email response area
    const existingEmailResponse = document.getElementById('email-response-container');
    if (existingEmailResponse) {
      existingEmailResponse.innerHTML = `
        <div class="email-response-loading">
          <div class="loading-spinner"></div>
          <p>Generating ${toneType} response...</p>
        </div>
      `;
    }

    try {
      // Create system prompt for generating email response based on sentiment analysis
      let systemPrompt = '';

      if (mode === 'draft') {
        // In draft mode, we proofread or rewrite but DO NOT create a response
        if (toneType === 'proofread') {
          systemPrompt = `You are a professional proofreader AI. Follow these instructions strictly:

1. ONLY correct:
   - Spelling mistakes
   - Grammar and punctuation errors
   - Awkward sentence structure (only if needed for clarity)

2. DO NOT:
   - Add, remove, or rephrase content
   - Change tone, format, or style
   - Summarize, explain, label, or formalize anything
   - Output more than one sentence or paragraph

3. Output MUST:
   - Match the input's sentence count and structure
   - Preserve slang, contractions, and natural tone
   - Return only the corrected sentence — nothing more

4. Use NLP to detect and mirror the user's natural tone, formality, and phrasing.
  
5. Then structure the email with these REQUIRED elements:
   1. Begin with "Suggested Subject: [Your subject line]" on the first line
   2. Add an appropriate greeting based on your sentiment analysis (include recipient's name if detected)
   3. End with an appropriate complimentary close based on your sentiment analysis (e.g., "Best regards,", "Sincerely,", etc.)
   5. NEVER sign with a name - leave blank after the closing

	If the input is quoted (e.g., starts with a quote), treat it as locked. Return ONLY a technically corrected version, still in quotes. Do NOT expand or rephrase it as an email or message. Return no metadata.

	If the user input is a single sentence or paragraph, return ONLY that corrected version. Do NOT reformat it as an email, greeting, message, or letter. DO NOT expand, rewrite, rephrase, or formalize the user's tone in any way. If the input starts with a quote ("), return the corrected version still wrapped in quotes.
	Never include inappropriate, offensive, harmful language, profanity, hate speech, slurs, and defamatory content.`;
        } else if (toneType === 'professional') {
          systemPrompt = `You are an expert email writer and sentiment analyzer.
  Create a complete, professional email based on this short prompt or request.
  
  The email should be in a professional tone, which means:
  Clear, direct, and efficient language. Respectful but not overly formal. Uses some contractions, focuses on facts and solutions, polite but straight to the point.
  
  Use NLP to detect and mirror the user's natural tone
  
  FIRST, analyze the sentiment and tone of the input to determine the appropriate:
  1. Subject line
  2. Greeting/salutation
  3. Closing/sign-off
  
  Then structure the email with these REQUIRED elements:
  1. Begin with "Suggested Subject: [Your subject line]" on the first line
  2. Add an appropriate greeting based on your sentiment analysis (include recipient's name if detected)
  3. Write the body of the email in a professional tone
  4. End with an appropriate complimentary close based on your sentiment analysis (e.g., "Best regards,", "Sincerely,", etc.)
  5. NEVER sign with a name - leave blank after the closing
  
  DO NOT:
   - Add, remove, or rephrase content beyond correction
   - Change meaning, summarize, or label
   - Output multiple sentences or paragraphs
   
  Output MUST:
   - Match the input structure and approximate length
   - Preserve user intent
   - Return only the corrected version (no extra text or labels)
   
   Apply THIS strict tone profile:
   - Interdependent (30% Independent, 70% Interdependent)
   - Slightly Status-oriented (30/70)
   - Certainty-seeking (20/80 Risk/Certainty)
   - Direct (80% Direct, 20% Indirect)
   - Balanced Task/Relationship (60/40)
  
  Use NLP writing style.
  Always maintain a constructive, positive, and professional approach. Tailor your subject line and closing to match the detected tone and purpose of the email.
  Never include inappropriate, offensive, harmful language, profanity, hate speech, slurs, and defamatory content.`;
        } else if (toneType === 'formal') {
          systemPrompt = `You are an expert email writer and sentiment analyzer.
  Create a complete, formal email based on this short prompt or request.
  
  The email should be in a formal tone, which means:
  Highly structured, proper language, no contractions or slang, respectful addresses, use of full titles, avoids personal anecdotes, maintains distance and authoritative voice.
  
  DO NOT:
   - Add, rephrase, summarize, explain
   - Output more than one sentence or paragraph

  Output MUST:
   - Match input structure and preserve meaning
   - Be corrected AND rewritten into a formal tone:
     - Avoid contractions
     - Use precise, respectful, academic/business language
     - Remove slang or casual expressions
  
  FIRST, analyze the sentiment and tone of the input to determine the appropriate:
  1. Subject line
  2. Greeting/salutation
  3. Closing/sign-off
  
  Then structure the email with these REQUIRED elements:
  1. Begin with "Suggested Subject: [Your subject line]" on the first line
  2. Add an appropriate formal greeting based on your sentiment analysis (include recipient's name or title if detected)
  3. Write the body of the email in a formal tone
  4. End with an appropriate formal complimentary close based on your sentiment analysis (e.g., "Respectfully,", "Sincerely,", etc.)
  5. NEVER sign with a name - leave blank after the closing
  
  Use NLP writing style.
  Always maintain a dignified, authoritative, and formal approach. Tailor your subject line and closing to match the detected tone and purpose of the email.
  Never include inappropriate, offensive, harmful language, profanity, hate speech, slurs, and defamatory content.`;
        } else if (toneType === 'casual') {
          systemPrompt = `You are an expert email writer and sentiment analyzer.
  Create a complete, casual email based on this short prompt or request.
  
  The email should be in a casual tone, which means:
  Relaxed language with contractions, some slang (but still professional), uses first names, includes some personal touches, more conversational flow, friendly tone.
  
  FIRST, analyze the sentiment and tone of the input to determine the appropriate:
  1. Subject line
  2. Greeting/salutation
  3. Closing/sign-off
  
  Then structure the email with these REQUIRED elements:
  1. Begin with "Suggested Subject: [Your subject line]" on the first line
  2. Add an appropriate casual greeting based on your sentiment analysis (include first name if detected)
  3. Write the body of the email in a casual tone
  4. End with an appropriate casual complimentary close based on your sentiment analysis (e.g., "Cheers,", "Thanks,", "Talk soon,", etc.)
  5. NEVER sign with a name - leave blank after the closing
  
     Apply THIS strict tone profile:
   - Interdependent (30% Independent, 70% Interdependent)
   - Slightly Status-oriented (30/70)
   - Certainty-seeking (20/80 Risk/Certainty)
   - Direct (80% Direct, 20% Indirect)
   - Balanced Task/Relationship (60/40)
  
  Use NLP writing style.
  Always maintain a friendly, approachable, and casual but still professional approach. Tailor your subject line and closing to match the detected tone and purpose of the email.
  Never include inappropriate, offensive, harmful language, profanity, hate speech, slurs, and defamatory content.`;
        } else if (toneType === 'friendly') {
          systemPrompt = `You are an expert email writer and sentiment analyzer.
  Create a complete, friendly email based on this short prompt or request.
  
  The email should be in a friendly tone, which means:
  Warm and personable, uses encouraging language, personal anecdotes where appropriate, expresses empathy, conversational style with questions, shows genuine care and interest.
  
  Correct grammar, punctuation, and structure as needed
  Keep the tone light, empathetic, and caring
  Use friendly, supportive phrasing
  NEVER rephrase intent — preserve user's message and meaning
  Output only a single, corrected, friendly-sounding version.
  
  FIRST, analyze the sentiment and tone of the input to determine the appropriate:
  1. Subject line
  2. Greeting/salutation
  3. Closing/sign-off
  
  Then structure the email with these REQUIRED elements:
  1. Begin with "Suggested Subject: [Your subject line]" on the first line
  2. Add an appropriate warm greeting based on your sentiment analysis (include first name if detected)
  3. Write the body of the email in a friendly tone
  4. End with an appropriate warm complimentary close based on your sentiment analysis (e.g., "Warm regards,", "All the best,", etc.)
  5. NEVER sign with a name - leave blank after the closing
  
     Apply THIS strict tone profile:
   - Interdependent (30% Independent, 70% Interdependent)
   - Slightly Status-oriented (30/70)
   - Certainty-seeking (20/80 Risk/Certainty)
   - Direct (80% Direct, 20% Indirect)
   - Balanced Task/Relationship (60/40)
  
  Use NLP writing style.
  Always maintain a warm, caring, and friendly approach. Tailor your subject line and closing to match the detected tone and purpose of the email.
  Never include inappropriate, offensive, harmful language, profanity, hate speech, slurs, and defamatory content.`;
        } else {
          // Default catch-all prompt
          systemPrompt = `You are an expert email writer and sentiment analyzer.
  Create a complete, professional email based on this short prompt or request.
  
  The email should be in a ${toneType} tone.
  
  FIRST, analyze the sentiment and tone of the input to determine the appropriate:
  1. Subject line
  2. Greeting/salutation
  3. Closing/sign-off
  
  Then structure the email with these REQUIRED elements:
  1. Begin with "Suggested Subject: [Your subject line]" on the first line
  2. Add an appropriate greeting based on your sentiment analysis (include recipient's name if detected)
  3. Write the body of the email in the requested tone
  4. End with an appropriate complimentary close based on your sentiment analysis (e.g., "Best regards,", "Sincerely,", etc.)
  5. NEVER sign with a name - leave blank after the closing
  
     Apply THIS strict tone profile:
   - Interdependent (30% Independent, 70% Interdependent)
   - Slightly Status-oriented (30/70)
   - Certainty-seeking (20/80 Risk/Certainty)
   - Direct (80% Direct, 20% Indirect)
   - Balanced Task/Relationship (60/40)
  
  Use NLP writing style.
  Always maintain a constructive and positive approach appropriate to the selected tone. Tailor your subject line and closing to match the detected tone and purpose of the email.
  Never include inappropriate, offensive, harmful language, profanity, hate speech, slurs, and defamatory content.`;
        }
      } else if (mode === 'rewrite') {
        // This is for rewriting the original email in a different tone
        systemPrompt = `You are an expert email writer.
    Your task is to rewrite the provided email in a ${toneType} tone, which means:
    ${getToneDescription(toneType)}
    
    Maintain the same content and meaning as the original email.
    Do not create a response to this email.
    Only rewrite the original email in the requested tone.
    
    The rewritten email should:
    1. Have the same basic content as the original
    2. Be clear, concise, and professional
    3. Maintain appropriate boundaries
    
    Do not include salutations or email signatures unless they were in the original.
    Do not mention that this was AI-generated or that you analyzed the message.
    Always maintain a constructive and positive approach.
    Never include inappropriate, offensive, or harmful language.`;
      } else {
        // In email response mode, generate a full response to the original
        systemPrompt = `You are an expert email response generator specializing in professional communications.

Your task is to create a precise, effective email response based on a detailed sentiment analysis of the original message.

The response should be in a ${toneType} tone, which means:
${getToneDescription(toneType)}

TONE REQUIREMENTS:
- Clear, direct language with appropriate formality
- Tailored to the specific tone selected
- Natural human writing patterns
- Appropriate confidence level for the selected tone
- Balanced approach to task and relationship elements

ANALYSIS INSTRUCTIONS:
1. FIRST, carefully analyze the sentiment data provided (Overall Sentiment, Confidence Level, Executive Summary, Emotional Profile, Mindset & Bias, Style & Delivery)
2. Identify the key emotional elements in the original message
3. Note the level of formality used by the sender
4. Recognize any underlying concerns or unstated needs
5. Determine if there are time-sensitive elements requiring acknowledgment

RESPONSE FORMAT:
1. Subject line: Start with "Subject: [Clear, relevant subject that references the original topic]"
2. Appropriate greeting based on tone selection
3. Acknowledgment: Briefly acknowledge the original message
4. Body: Address key points concisely with the selected tone
5. Closing: End with a clear next step or expectation
6. Sign-off: Appropriate for the selected tone followed by "YOUR NAME HERE"

CRITICAL GUARDRAILS:
- Maximum length: 150-200 words (approximately 3-4 paragraphs)
- Never create fictional details, data, or attachments
- Do not apologize for being AI-generated
- Never mention that you performed sentiment analysis
- Response must maintain the selected tone regardless of original message's emotion
- Do not include inappropriate, offensive, harmful language
- Write in natural human language patterns avoiding AI detection

   Apply THIS strict tone profile:
   - Interdependent (30% Independent, 70% Interdependent)
   - Slightly Status-oriented (30/70)
   - Certainty-seeking (20/80 Risk/Certainty)
   - Direct (80% Direct, 20% Indirect)
   - Balanced Task/Relationship (60/40)

Your response must sound like it was written by a competent professional who has fully understood both the explicit content and emotional context of the message.`;
      }

      // Extract key information from the sentiment analysis
      const originalText = lastAnalyzedText;

      // Get values from the last analysis result
      const overallSentiment = lastAnalysisResult.sentiment || 'Neutral';
      const confidenceLevel = lastAnalysisResult.confidence || 70;
      const executiveSummary = lastAnalysisResult.executiveSummary || '';
      const emotionalProfile = lastAnalysisResult.emotionalProfile || '';
      const mindsetBias = lastAnalysisResult.mindsetBias || '';
      const styleDelivery = lastAnalysisResult.styleDelivery || '';

      // Create user message with analysis data
      let userMessage = '';

      if (mode === 'draft') {
        // For draft mode, we're proofreading or rewriting the original
        if (toneType === 'proofread') {
          userMessage = `Proofread the following EXACTLY as written, making only technical corrections:

"${originalText}"

Return ONLY the corrected text with no additional formatting or content.`;
        } else {
          userMessage = `Original Email: "${originalText}"

Analyze this email to determine appropriate subject line, greeting, and closing. 
Then rewrite this email in a ${toneType} tone while preserving its core content and meaning.
Start with "Suggested Subject:" and then include a complete email with appropriate greeting and closing.
DO NOT write a response to this email. Only rewrite the original email.`;
        }
      } else {
        // For email response mode, we're generating a response based on analysis
        userMessage = `Original Message: "${originalText}"

Sentiment Analysis:
- Overall Sentiment: ${overallSentiment}
- Confidence Level: ${confidenceLevel}%
- Executive Summary: ${executiveSummary}
- Emotional Profile: ${emotionalProfile}
- Mindset & Bias: ${mindsetBias}
- Style & Delivery: ${styleDelivery}

Based on this sentiment analysis, generate a ${toneType} response to this message.
Start with "Suggested Subject:" and then include a complete email with an appropriate greeting and closing.`;
      }

      // Request generation from OpenAI
      const response = await fetch("/openai.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          model: "gpt-4-turbo",
          messages: [{
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          temperature: 0.7 // Balanced creativity
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // Only increment counter if this isn't the first generation
      if (document.querySelector('.email-tone-selector')) {
        emailToneChangeCount++;
      }

      // Process the response text
      let emailText = data.choices[0].message.content.trim();

      // Word count guardrail - Anti-hallucination
      const inputWords = originalText ? originalText.trim().split(/\s+/).length : 0;
      const outputWords = emailText.split(/\s+/).length;
      if (Math.abs(inputWords - outputWords) > 2 && toneType === 'proofread') {
        console.warn(`⚠️ Potential hallucination in ${toneType} tone — output deviated in word count.`);
        // For proofread mode, the input and output should be similar in length
      }

      // Apply safety filter
      emailText = ToneSafeguard.filterContent(emailText);

      // Check if email response container exists, update it or create it
      if (existingEmailResponse) {
        createEmailResponseContent(existingEmailResponse, emailText, toneType);
      } else {
        createEmailResponseContainer(emailText, toneType);
      }

    } catch (error) {
      console.error("Error generating email response:", error);
      showNotification('Failed to generate email response. Please try again.', 'error');

      // Remove loading state if there was an error
      const existingEmailResponse = document.getElementById('email-response-container');
      if (existingEmailResponse && existingEmailResponse.querySelector('.email-response-loading')) {
        existingEmailResponse.innerHTML = `
          <div class="email-response-error">
            <p>Error generating email response. Please try again.</p>
          </div>
        `;
      }
    }
  }

  // Helper function to get tone description
  function getToneDescription(toneType) {
    const toneDescriptions = {
      'proofread': 'Correct spelling, grammar, punctuation, and formatting only. Preserve the original tone, style, and content.',
      'formal': 'Highly structured, proper language, no contractions or slang, respectful addresses, use of full titles, avoids personal anecdotes, maintains distance and authoritative voice.',
      'professional': 'Clear, direct, and efficient language. Respectful but not overly formal. Uses some contractions, focuses on facts and solutions, polite but straight to the point.',
      'casual': 'Relaxed language with contractions, some slang (but still professional), uses first names, includes some personal touches, more conversational flow, friendly tone.',
      'friendly': 'Warm and personable, uses encouraging language, personal anecdotes where appropriate, expresses empathy, conversational style with questions, shows genuine care and interest.'
    };

    return toneDescriptions[toneType] || toneDescriptions['proofread'];
  }

  // Create email response container
  function createEmailResponseContainer(emailText, toneType) {
    // Create container element
    const container = document.createElement('div');
    container.id = 'email-response-container';
    container.className = 'email-response-container';

    // Add content to container
    createEmailResponseContent(container, emailText, toneType);

    // Insert at the top of the fullReport element
    fullReport.insertBefore(container, fullReport.firstChild);

    // Scroll to the email response (just once)
    container.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }


  // Create email response content within container
  function createEmailResponseContent(container, emailText, toneType) {
    // Show remaining tone changes message
    const remainingChanges = MAX_TONE_CHANGES - emailToneChangeCount;
    let remainingChangesText = '';

    if (remainingChanges > 0) {
      remainingChangesText = `<div class="remaining-changes">${remainingChanges} tone change${remainingChanges !== 1 ? 's' : ''} remaining</div>`;
    } else {
      remainingChangesText = `<div class="remaining-changes exhausted">No tone changes remaining</div>`;
    }

    // Determine the correct title based on the selected mode
    let headerTitle = "Tone & Sentiment Analysis";
    if (analysisMode === 'draft') {
      headerTitle = "Draft Email Assistant";
    } else if (analysisMode === 'email') {
      headerTitle = "Email Response Assistant";
    }

    // Add this code here - start of enhancement
    // Check if the email starts with "Suggested Subject:" and format it
    if (emailText.startsWith("Suggested Subject:")) {
      // Split the email into subject line and the rest
      const subjectLineEnd = emailText.indexOf("\n");
      if (subjectLineEnd !== -1) {
        const subjectLine = emailText.substring(0, subjectLineEnd);
        const emailBody = emailText.substring(subjectLineEnd + 1);

        // Format with the subject line highlighted
        emailText = `<div class="suggested-subject">${subjectLine}</div>${emailBody}`;
      }
    }

    // Create content
    container.innerHTML = `
    <div class="email-response-header">
      <h3>${headerTitle}</h3>
      <div class="email-tone-selector">
        ${analysisMode === 'draft' ? 
          `<button class="tone-btn ${toneType === 'proofread' ? 'active' : ''}" data-tone="proofread">Proofread</button>` : ''
        }
        <button class="tone-btn ${toneType === 'professional' ? 'active' : ''}" data-tone="professional">Professional</button>
        <button class="tone-btn ${toneType === 'formal' ? 'active' : ''}" data-tone="formal">Formal</button>
        <button class="tone-btn ${toneType === 'casual' ? 'active' : ''}" data-tone="casual">Casual</button>
        <button class="tone-btn ${toneType === 'friendly' ? 'active' : ''}" data-tone="friendly">Friendly</button>
      </div>
      ${remainingChangesText}
    </div>
    <div class="email-response-body">
      <div class="email-content">${emailText.replace(/\n/g, '<br>')}</div>
    </div>
    <div class="email-response-footer">
      <button class="copy-email-btn">
        <i class="fas fa-copy"></i> Copy to Clipboard
      </button>
    </div>
  `;

    // Add event listeners for tone buttons
    const toneButtons = container.querySelectorAll('.tone-btn');
    toneButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return; // Skip if already active

        // Ensure we haven't reached the maximum changes
        if (emailToneChangeCount >= MAX_TONE_CHANGES) {
          showNotification(`You've reached the maximum of ${MAX_TONE_CHANGES} tone changes.`, 'warning');
          return;
        }

        // Update active button
        toneButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Generate new response with selected tone
        const tone = btn.getAttribute('data-tone');
        generateEmailResponse(tone, analysisMode);
      });
    });

    // Add event listener for copy button
    const copyButton = container.querySelector('.copy-email-btn');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const emailContent = container.querySelector('.email-content');
        if (emailContent) {
          // Get text content, replacing <br> with newlines
          const textToCopy = emailContent.innerHTML
            .replace(/<br\s*\/?>/gi, '\n') // Replace <br> tags with newlines
            .replace(/<[^>]*>/g, ''); // Remove any other HTML tags

          // Copy to clipboard
          navigator.clipboard.writeText(textToCopy)
            .then(() => {
              showNotification('Email response copied to clipboard!', 'success');

              // Briefly change button text
              const originalText = copyButton.innerHTML;
              copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
              setTimeout(() => {
                copyButton.innerHTML = originalText;
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy: ', err);
              showNotification('Failed to copy to clipboard. Please try again.', 'error');
            });
        }
      });
    }
  }

  // Function to extract data from sentiment analysis
  function extractSentimentData(reportHTML) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = reportHTML;

    // Create a data object to store extracted values
    const data = {
      sentiment: extractSentiment(reportHTML),
      confidence: extractConfidence(reportHTML),
      executiveSummary: '',
      emotionalProfile: '',
      mindsetBias: '',
      styleDelivery: '',
      strategyFit: '',
      languageNotes: '',
      reliability: ''
    };

    // Extract section content
    const sections = tempDiv.querySelectorAll('.report-section');
    sections.forEach(section => {
      const heading = section.querySelector('h3');
      if (!heading) return;

      const headingText = heading.textContent.trim();
      const content = section.querySelector('p');
      if (!content) return;

      const contentText = content.textContent.trim();

      // Map headings to data object
      if (headingText.includes('Executive Summary')) {
        data.executiveSummary = contentText;
      } else if (headingText.includes('Emotional Profile')) {
        data.emotionalProfile = contentText;
      } else if (headingText.includes('Mindset & Bias')) {
        data.mindsetBias = contentText;
      } else if (headingText.includes('Style & Delivery')) {
        data.styleDelivery = contentText;
      } else if (headingText.includes('Strategy & Fit')) {
        data.strategyFit = contentText;
      } else if (headingText.includes('Language Notes')) {
        data.languageNotes = contentText;
      } else if (headingText.includes('Reliability')) {
        data.reliability = contentText;
      }
    });

    return data;
  }

  if (runAnalysisBtn) {
    runAnalysisBtn.addEventListener("click", async function() {
      const text = textInput.value.trim();

      // --- ENHANCEMENT: Input validation ---
      if (!text) {
        fullReport.innerHTML = "<p class='error'>⚠️ Please enter text for analysis.</p>";
        return;
      }

      // --- ENHANCEMENT: Check word count before analysis ---
      const wordCount = text.split(/\s+/).length;
      if (wordCount > 500) {
        fullReport.innerHTML = "<p class='error'>⚠️ Text exceeds the 500 word limit. Please shorten your text.</p>";
        return;
      }

      // --- ENHANCEMENT: Check if cooldown is active ---
      if (cooldownActive) {
        fullReport.innerHTML = `<p class='error'>⚠️ Please wait ${cooldownSeconds} seconds before running another analysis.</p>`;
        if (cooldownNoticeContainer.querySelector('.cooldown-indicator')) {
          cooldownNoticeContainer.querySelector('.cooldown-indicator').classList.add('pulse');
          setTimeout(() => {
            cooldownNoticeContainer.querySelector('.cooldown-indicator').classList.remove('pulse');
          }, 1500);
        }
        return;
      }

      // --- ENHANCEMENT: Check daily limit ---
      resetUsageCountIfNewDay();
      const usageCount = await getUsageCount();
      if (usageCount >= DAILY_LIMIT) {
        fullReport.innerHTML = `<p class='error'>⚠️ You have reached your daily limit of ${DAILY_LIMIT} analyses. Please try again tomorrow.</p>`;
        return;
      }

      // Show loading animation
      loadingAnimation.style.display = "flex";
      fullReport.innerHTML = "";

      // Store the text for later reference
      lastAnalyzedText = text;

      // Reset email tone change counter when starting a new analysis
      emailToneChangeCount = 0;

      // Set default tone based on mode
      let defaultTone = analysisMode === 'draft' ? 'proofread' : 'professional';

      // Scroll to loading animation
      setTimeout(() => {
        loadingAnimation.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);

      // Run analysis after a small delay to allow UI updates
      setTimeout(() => {
        if (analysisMode === 'analyze') {
          analyzeSentiment(text);
        } else if (analysisMode === 'draft') {
          // For draft email mode, generate an email from the prompt
          analyzeSentiment(text, true, 'draft');
        } else {
          // For email response mode, analyze and generate response
          analyzeSentiment(text, true, 'email');
        }
      }, 300);
    });
  }


  if (refreshBtn) {
    refreshBtn.addEventListener("click", function() {
      textInput.value = "";
      fullReport.innerHTML = "";
      loadingAnimation.style.display = "none";

      // Fix: Check if loadingOverlay exists before using it
      const loadingOverlay = document.getElementById("loading-overlay");
      if (loadingOverlay) {
        loadingOverlay.style.display = "none";
      }

      document.body.style.overflow = ""; // Restore scrolling

      // Reset email tone change counter
      emailToneChangeCount = 0;

      // Clear last analyzed text and result
      lastAnalyzedText = '';
      lastAnalysisResult = null;

      // Update word count display
      const wordCountElement = document.getElementById('current-word-count');
      if (wordCountElement) {
        wordCountElement.textContent = "0";
        wordCountElement.style.color = '#666';
      }

      // Hide word limit notice
      wordLimitNoticeContainer.style.display = 'none';

      // Enable run button if it was disabled due to word count
      if (runAnalysisBtn && !cooldownActive) {
        runAnalysisBtn.disabled = false;
        runAnalysisBtn.classList.remove('disabled');
      }
    });
  }


  // Notification function
  function showNotification(message, type = "info") {
    // Remove any existing notification
    const existing = document.querySelector(".notification");
    if (existing) existing.remove();

    // Create new notification
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Append to body
    document.body.appendChild(notification);

    // Trigger a reflow for animation
    void notification.offsetWidth;

    // Show the notification with fade-in effect
    notification.style.display = "block";
    notification.style.opacity = "1";
    notification.style.transform = "translateY(0)";

    // Hide after 3 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateY(-10px)";
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // Extraction Functions
  function extractSentiment(responseText) {
    let match = responseText.match(/\*\*1\.\s*Overall Sentiment:\*\*\s*([\w]+)/i);
    if (!match) {
      match = responseText.match(/Overall Sentiment:\s*([\w]+)/i);
    }

    // If we didn't find a match or if it's "neutral", check the executive summary
    if (!match || match[1].trim().toLowerCase() === "neutral" || extractConfidence(responseText) < 0.6) {
      // Look for sentiment words in the executive summary
      const executiveSummary = extractSection(responseText, "Executive Summary", true);
      if (executiveSummary) {
        // Check for explicit sentiment mentions in the executive summary
        const lowerSummary = executiveSummary.toLowerCase();
        // First check for the exact phrase "sentiment is X" or "sentiment of the text is X"
        const sentimentMention = lowerSummary.match(/sentiment (?:is|of the text is) (positive|negative|neutral)/i);
        if (sentimentMention) {
          return sentimentMention[1].charAt(0).toUpperCase() + sentimentMention[1].slice(1);
        }

        // Fall back to checking for sentiment words (with safer phrasing checks only)
        if (lowerSummary.includes("sentiment is negative")) {
          return "Negative";
        } else if (lowerSummary.includes("sentiment is positive")) {
          return "Positive";
        } else if (lowerSummary.includes("sentiment is neutral")) {
          return "Neutral";
        }
      }
    }

    // Return the matched sentiment or default to "Neutral"
    return match ? match[1].trim() : "Neutral";
  }

  function extractConfidence(responseText) {
    let match = responseText.match(/\*\*2\.\s*Confidence Level:\*\*\s*([\d.]+)/i);
    if (!match) {
      match = responseText.match(/Confidence Level:\s*([\d.]+)/i);
    }
    return match ? parseFloat(match[1]) / 100 : 0.9;
  }

  function extractSection(responseText, section, stopAtSectionNumber = false) {
    // Try with regular numbers instead of emoji
    let pattern = `(?:^|\\n)\\s*(?:\\*\\*)?\\s*(?:\\d+\\.?\\s*)?${section}(?:\\s*\\(.*?\\))?:\\s*(?:\\*\\*)?\\s*([\\s\\S]*?)`;

    // If we need to stop at the next section, use a more reliable pattern
    if (stopAtSectionNumber) {
      pattern += '(?=\\n\\s*(?:\\*\\*)?\\s*\\d+[\\.:][\\s\\S]|$)';
    } else {
      pattern += '(?=\\n\\s*(?:\\*\\*)?\\s*[A-Za-z]|$)';
    }

    let regex = new RegExp(pattern, 'i');
    let match = responseText.match(regex);

    if (match && match[1] && match[1].trim()) {
      // Clean up the extracted text to remove any embedded section references
      return cleanExtractedSection(match[1].trim());
    }

    // Try with just the section name (no emojis)
    regex = new RegExp(`\\*\\*\\s*${section}(?:\\s*\\(.*?\\))?:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i');
    match = responseText.match(regex);
    if (match && match[1].trim()) {
      return cleanExtractedSection(match[1].trim());
    }

    // Try alternate formats if first attempt failed
    const alternatePatterns = [
      // Try with just the section name
      `${section}(?:\\s*\\(.*?\\))?:\\s*([\\s\\S]*?)(?=\\n\\s*\\d+|\\n\\s*[A-Za-z]+:|$)`,
      // Try with numbered format without **
      `\\d+\\.?\\s*${section}(?:\\s*\\(.*?\\))?:\\s*([\\s\\S]*?)(?=\\n\\s*\\d+|\\n\\s*[A-Za-z]+:|$)`,
      // Try with just a simple colon format
      `${section}(?:\\s*\\(.*?\\))?:\\s*([\\s\\S]*?)(?=\\n\\n|\\n\\s*[A-Za-z]+:|$)`
    ];

    for (const pattern of alternatePatterns) {
      regex = new RegExp(pattern, 'i');
      match = responseText.match(regex);
      if (match && match[1] && match[1].trim()) {
        return cleanExtractedSection(match[1].trim());
      }
    }

    return "";
  }

  // Improved clean-up function
  function cleanExtractedSection(text) {
    // Remove lines that start with regular numbers followed by section titles
    text = text.replace(/\n\s*\d+\s*\.?\s*[A-Za-z\s&]+(?:\([^)]*\))?:.+/g, '');

    // Remove embedded section references
    text = text.replace(/\s*\d+\s*\.?\s*[A-Za-z\s&]+(?:\([^)]*\))?:\s*\*?\*?/g, '');

    // Remove asterisks for emphasis
    text = text.replace(/\*\*/g, '');

    // Clean up bulleted/numbered lists created with markdown
    text = text.split('\n')
      .map(line => line.replace(/^\s*(?:[-‐‑‒–—―*]+\s*)+/g, ''))
      .join('\n');

    return text;
  }

  // Helper function to provide default values for missing sections
  function getDefaultForSection(sectionName) {
    const defaults = {
      "Executive Summary": "No high-level synthesis or recommendations were provided.",
      "Emotional Profile": "None detected.",
      "Mindset & Bias": "None detected.",
      "Style & Delivery": "None detected.",
      "Strategy & Fit": "None detected.",
      "Language Notes": "None detected.",
      "Reliability": "None detected.",
    };

    return defaults[sectionName] || "No information provided.";
  }

  function extractEmotions(responseText) {
    return extractSection(responseText, "Identified Emotions & Supporting Examples");
  }

  function cleanOutput(text) {
    return text.split('\n')
      .map(line => line.replace(/^\s*(?:[-‐‑‒–—―*]+\s*)+/g, ''))
      .join('\n');
  }

  // Exponential backoff function for handling rate limits
  async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After')) || Math.pow(2, i) * 5;
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }



  // Analyze Sentiment using your protected server endpoint
  async function analyzeSentiment(text, generateEmailAfter = false, mode = 'analyze') {
    // Queue the analysis request
    RequestQueue.add(async () => {
      // Prevent multiple simultaneous analyses
      if (window.isAnalyzing) {
        showNotification('Analysis already in progress', 'warning');
        return;
      }
      window.isAnalyzing = true;

      // Add timing check at the beginning
      const now = Date.now();
      const timeSinceLastAnalysis = now - lastTextAnalysisTime;

      if (timeSinceLastAnalysis < TEXT_ANALYSIS_COOLDOWN) {
        const waitTime = Math.ceil((TEXT_ANALYSIS_COOLDOWN - timeSinceLastAnalysis) / 1000);
        showNotification(`Please wait ${waitTime} seconds before the next analysis.`, 'warning');
        window.isAnalyzing = false;
        return;
      }

      lastTextAnalysisTime = now;

      try {
        const systemPrompt =
          `You are an expert emotional intelligence analyst trained to detect nuanced emotions in text. Your task is to perform a comprehensive multi-layer sentiment analysis with high accuracy. Conduct a comprehensive multi-layer sentiment analysis on the provided text. Provide unique, detailed, and professional insights in each section below. Do not use placeholder text or generic responses.
        
        ### Output Format (Professional Report)
        
        **Sentiment Analysis Report**
        
        EMOTION DETECTION GUIDELINES:

        For each of the six basic emotions, use these specific indicators:

        JOY:
        - Look for: positive words (happy, great, wonderful), exclamation marks, praise, gratitude expressions
        - Intensity markers: "very happy" = high, "pleased" = moderate, "okay" = low
        - Context clues: achievements, celebrations, positive outcomes

        SADNESS:
        - Look for: negative emotional words (sad, disappointed, hurt), expressions of loss
        - Intensity markers: "devastated" = high, "unhappy" = moderate, "slightly down" = low
        - Context clues: loss, failure, rejection, endings

        ANGER:
        - Look for: words indicating frustration, annoyance, rage, complaint language
        - Intensity markers: "furious" = high, "frustrated" = moderate, "annoyed" = low
        - Context clues: blame, criticism, confrontational language

        FEAR:
        - Look for: words expressing worry, anxiety, concern, uncertainty
        - Intensity markers: "terrified" = high, "worried" = moderate, "concerned" = low
        - Context clues: threats, risks, unknown outcomes

        SURPRISE:
        - Look for: unexpected outcomes, shock expressions, sudden realizations
        - Intensity markers: "shocked" = high, "surprised" = moderate, "unexpected" = low
        - Context clues: plot twists, revelations, sudden changes

        DISGUST:
        - Look for: expressions of distaste, rejection, moral judgment
        - Intensity markers: "revolted" = high, "dislike" = moderate, "unpleasant" = low
        - Context clues: rejection language, moral criticism, physical revulsion

        OUTPUT FORMAT:

        **1. Overall Sentiment:** [Your classification: Very Positive, Positive, Neutral, Negative, Very Negative, Mixed, or Uncertain]
        *Confidence Level:* [Include your accurate confidence level as part of this analysis, e.g., 90%.]

        **2. Executive Summary:**
        [Provide a concise, high-level synthesis of the text's emotional and tonal landscape—summarize the key emotional drivers, communication style, persuasion goals, and strategic implications—then offer 2–3 prioritized, actionable recommendations to optimize impact.]

        **3. Emotional Profile:**
        [Break down the primary emotions detected, quoting specific examples; assign an intensity level (Low, Moderate, High) to each; highlight any expressions of empathy or support; and summarize how these emotions combine to shape the overall tone.]

        **4. Mindset & Bias:**
        [Identify any cognitive or confirmation biases influencing the message (e.g., positivity bias, sunk-cost fallacy), uncover implicit assumptions or hidden meaning, and analyze the speaker's underlying psychological frame or motivations.]

        **5. Style & Delivery:**
        [Evaluate the register (Formal, Semi-formal, Informal), urgency level, and directness of the call to action; detect any shifts or inconsistencies in tone; and rate the assertion level (Assertive, Tentative, Passive), citing illustrative excerpts.]

        **6. Strategy & Fit:**
        [Analyze the core intent and persuasive techniques (emotional appeals, framing devices); interpret how the tone supports brand image or audience trust; and situate the communication within its relevant contextual or historical backdrop.]

        **7. Language Notes:**
        [Extract and explain all non-literal language (idioms, metaphors, cultural references, slang) with simple translations; identify any sarcasm and interpret its intent; identify any slang and its meaning, and clarify slang or colloquialisms, noting potential cross-cultural nuances.]

        **8. Reliability:**
        [Assess the speaker's certainty by flagging hedging or indecisive qualifiers; highlight any potential deceptive cues (contradictions, omissions, overly elaborate denials); and summarize aimed at delivering maximum clarity and professional-grade insight.`;

        // Make sure loading animation is centered
        const loadingOverlay = document.getElementById("loading-overlay");
        loadingOverlay.style.display = "block";
        document.body.style.overflow = "hidden"; // Prevent scrolling while loading


        const response = await fetchWithRetry("/openai.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            model: "gpt-4-turbo",
            messages: [{
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: `Analyze this text: "${text}"`
              }
            ],
            temperature: 0.7 // Balanced creativity
          })
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
          throw new Error("Invalid API response format: No valid message content found.");
        }

        const apiOutput = data.choices[0].message.content.trim();
        const safeOutput = escapeHTML(apiOutput);

        // Extract sections from the API output
        const sentimentWord = extractSentiment(apiOutput);
        const confidenceScore = extractConfidence(apiOutput);
        const confidencePercentage = Math.min(100, Math.max(0, Math.round(confidenceScore * 100))) + "%";

        // No longer using sentiment emoji and color since those sections are removed
        // These functions still exist but return empty/default values
        // const sentimentEmoji = getSentimentEmoji(sentimentWord);
        // const sentimentColor = getSentimentColor(sentimentWord);

        // Extract all sections, ensuring proper separation between sections
        let emotions = extractSection(apiOutput, "Identified Emotions & Supporting Examples", true);
        if (emotions) {
          emotions = cleanOutput(emotions);
        }

        const executiveSummary = extractSection(apiOutput, "Executive Summary", true) ||
          getDefaultForSection("Executive Summary");

        // Try multiple patterns to reliably capture the Emotional Profile block
        const emotionalProfile =
          extractSection(apiOutput, "Emotional Profile", true) ||
          extractSection(apiOutput, "\\d+\\.?\\s*Emotional Profile", true) ||
          extractSection(apiOutput, "\\*\\*Emotional Profile\\*\\*", true) ||
          getDefaultForSection("Emotional Profile");

        const mindsetBias = extractSection(apiOutput, "Mindset & Bias", true) ||
          getDefaultForSection("Mindset & Bias");

        const styleDelivery = extractSection(apiOutput, "Style & Delivery", true) ||
          getDefaultForSection("Style & Delivery");

        const strategyFit = extractSection(apiOutput, "Strategy & Fit", true) ||
          getDefaultForSection("Strategy & Fit");

        const languageNotes = extractSection(apiOutput, "Language Notes", true) ||
          getDefaultForSection("Language Notes");

        const reliability = extractSection(apiOutput, "Reliability", true) ||
          getDefaultForSection("Reliability");

        // Store extracted data for email response generation
        lastAnalysisResult = {
          sentiment: sentimentWord,
          confidence: parseInt(confidencePercentage),
          executiveSummary,
          emotionalProfile,
          mindsetBias,
          styleDelivery,
          strategyFit,
          languageNotes,
          reliability
        };


        const analysisOutput = `
  <div class="sentiment-report">
    <h2>Tone & Sentiment Analysis</h2>
    
    <div class="report-top-sections">
      <div class="report-section summary">
        <h3>1. Executive Summary</h3>
        <p>${executiveSummary}</p>
      </div>
    </div>
            
    <div class="report-section">
      <h3>2. Emotional Profile</h3>
      <p>${emotionalProfile}</p>
    </div>

    <div class="report-section">
      <h3>3. Mindset & Bias</h3>
      <p>${mindsetBias}</p>
    </div>

    <div class="report-section">
      <h3>4. Style & Delivery</h3>
      <p>${styleDelivery}</p>
    </div>

    <div class="report-section">
      <h3>5. Strategy & Fit</h3>
      <p>${strategyFit}</p>
    </div>

    <div class="report-section">
      <h3>6. Language Notes</h3>
      <p>${languageNotes}</p>
    </div>

    <div class="report-section">
      <h3>7. Reliability</h3>
      <p>${reliability}</p>
    </div>
  </div>
`;

        // Hide loading animation
        loadingAnimation.style.display = "none";
        loadingOverlay.style.display = "none";
        document.body.style.overflow = ""; // Restore scrolling

        // Insert analysis output
        fullReport.innerHTML = sanitizeReport(analysisOutput);

        // Add styles for the report elements
        const style = document.createElement('style');
        style.textContent = `
.sentiment-report {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.sentiment-report h2 {
  color: var(--primary-color);
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.8rem;
  border-bottom: 2px solid rgba(58, 123, 213, 0.2);
}
.report-top-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 2rem;
}
.report-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: #fbfbfd;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}
.report-section h3 {
  color: var(--primary-dark);
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.report-section p {
  margin-bottom: 0.8rem;
  line-height: 1.6;
}
.sentiment-overview {
  flex: 1;
  min-width: 300px;
  background-color: #f5f9ff;
  padding: 1.5rem;
}
.summary {
  flex: 2;
  min-width: 300px;
  background-color: #f5f5f5;
  border-left: 4px solid #2c3e50;
}
`;
        document.head.appendChild(style);

        // Auto-scroll to the report
        setTimeout(() => {
          fullReport.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);

        // Start cooldown period
        startCooldown();

        // Show success notification
        showNotification("Analysis completed successfully!", "success");

        // If we need to generate content after analysis
        if (generateEmailAfter) {
          // Reset email tone change counter for new analysis
          emailToneChangeCount = 0;

          // Generate the content based on mode
          setTimeout(() => {
            if (mode === 'draft') {
              // Generate an email from the prompt
              generateEmailDraft('proofread', text);
            } else {
              // Generate a response to the email
              generateEmailResponse('professional', mode);
            }
          }, 500);
        }

      } catch (error) {
        // Hide loading animation
        loadingAnimation.style.display = "none";
        loadingOverlay.style.display = "none";
        document.body.style.overflow = ""; // Restore scrolling

        // Handle 429 Too Many Requests error specifically
        if (error.message.includes('429')) {
          fullReport.innerHTML = "<p class='error'>⚠️ Too many requests. Please wait a moment before trying again.</p>";
          // Force a longer cooldown if we get a 429
          if (!cooldownActive) {
            // Set a longer cooldown period for server rate limit errors
            cooldownSeconds = Math.floor(Math.random() * 11) + 20; // 20-30 seconds for server errors
            startCooldown();
          }
        } else {
          fullReport.innerHTML = "<p class='error'>⚠️ Error analyzing sentiment. Please try again.</p>";
        }

        console.error("Sentiment Analysis Error:", error);

        // Show error notification
        const errorMessage = error.message.includes('429') ?
          "Too many requests. Please wait before trying again." :
          "Error analyzing sentiment. Please try again.";
        showNotification(errorMessage, "error");
      } finally {
        window.isAnalyzing = false;
      }
    });
  }


  // Escape HTML to prevent XSS
  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    } [tag]));
  }

  // Sanitize AI output before inserting into DOM (preserves safe formatting)
  function sanitizeReport(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove script and style tags completely
    tempDiv.querySelectorAll('script, style').forEach(el => el.remove());

    // Remove inline event attributes like onclick, onerror, etc.
    tempDiv.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });

    return tempDiv.innerHTML;
  }


  // ADD CSS STYLES FOR EMAIL RESPONSE FEATURE
  const emailStyles = document.createElement('style');
  emailStyles.textContent = `
    /* Mode Selector */
    .mode-selector {
      margin-bottom: 1rem;
    }
    
    .mode-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-light);
    }
    
    .mode-tab {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      position: relative;
      color: var(--text-light);
      transition: all 0.2s ease;
    }
    
    .mode-tab::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 3px;
      background-color: transparent;
      transition: background-color 0.2s ease;
    }
    
    .mode-tab.active {
      color: var(--primary-color);
    }
    
    .mode-tab.active::after {
      background-color: var(--primary-color);
    }
    
    .mode-tab:hover:not(.active) {
      color: var(--primary-dark);
    }
    
    /* Email Response Container */
    .email-response-container {
      margin-bottom: 2rem;
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      border: 1px solid var(--border-light);
      transition: all 0.3s ease;
    }
    
    .email-response-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-light);
      background-color: #f8f9fa;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .email-response-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--primary-color);
      display: flex;
      align-items: center;
    }
    
    .email-response-header h3::before {
      content: '\\f0e0';
      font-family: 'Font Awesome 6 Free';
      font-weight: 900;
      margin-right: 0.5rem;
      font-size: 1rem;
    }
    
    .email-tone-selector {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .tone-btn {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
      font-weight: 500;
      border: 1px solid #ddd;
      background-color: #f8f9fa;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .tone-btn:hover:not(.active) {
      background-color: #f0f0f0;
      border-color: #ccc;
    }
    
    .tone-btn.active {
      background-color: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
    
    .remaining-changes {
      font-size: 0.85rem;
      color: var(--text-light);
      text-align: right;
      margin-top: 0.5rem;
    }
    
    .remaining-changes.exhausted {
      color: var(--error-color);
      font-weight: 500;
    }
    
    .email-response-body {
      padding: 1.5rem;
      background-color: white;
    }
    
    .email-content {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      white-space: pre-wrap;
    }
    
    .email-response-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-light);
      background-color: #f8f9fa;
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
      display: flex;
      justify-content: flex-end;
    }
    
    .copy-email-btn {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }
    
    .copy-email-btn:hover {
      background-color: var(--primary-dark);
      transform: translateY(-1px);
    }
    
    .email-response-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 0;
    }
    
    .email-response-loading .loading-spinner {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(72, 99, 160, 0.1);
      border-radius: 50%;
      border-top: 3px solid var(--primary-color);
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    .email-response-loading p {
      color: var(--text-light);
      font-size: 0.9rem;
    }
    
    .email-response-error {
      padding: 1.5rem;
      text-align: center;
      color: var(--error-color);
    }
    
    @media (max-width: 768px) {
      .email-tone-selector {
        flex-wrap: wrap;
      }
      
      .tone-btn {
        flex: 1;
        min-width: 40%;
        text-align: center;
      }
    }
  `;
  document.head.appendChild(emailStyles);


  // Add CSS for subject line styling
  const subjectStyles = document.createElement('style');
  subjectStyles.textContent = `
  .suggested-subject {
    font-weight: bold;
    color: var(--primary-color);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
  }
`;
  document.head.appendChild(subjectStyles);

  // Add the notification styles
  const notificationStyles = document.createElement('style');
  notificationStyles.textContent = `
  .notification {
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    max-width: 320px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: none;
  }
  
  .notification.info {
    background-color: var(--primary-color);
    color: white;
  }
  
  .notification.success {
    background-color: var(--positive-color);
    color: white;
  }
  
  .notification.error {
    background-color: var(--negative-color);
    color: white;
  }
  
  .notification.warning {
    background-color: var(--accent-color);
    color: white;
  }
`;
  document.head.appendChild(notificationStyles);

  // Add a "scroll to top" button that appears when user scrolls down
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.className = 'scroll-top-btn';
  scrollTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  document.body.appendChild(scrollTopBtn);

  // Style the scroll to top button
  const scrollTopStyle = document.createElement('style');
  scrollTopStyle.textContent = `
    .scroll-top-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: var(--primary-color);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 999;
    }
    
    .scroll-top-btn.visible {
      opacity: 1;
      visibility: visible;
    }
    
    .scroll-top-btn:hover {
      background-color: var(--primary-dark);
      transform: translateY(-3px);
    }
  `;
  document.head.appendChild(scrollTopStyle);

  // Show/hide scroll to top button based on scroll position
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  });

  // Scroll to top when button clicked
  scrollTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Check if there's a daily usage count to display
  async function updateUsageBadge() {
    const usageCount = await getUsageCount();
    if (usageCount > 0) {
      // Create a small badge to show usage count
      let usageBadge = document.querySelector('.usage-badge');

      if (!usageBadge) {
        usageBadge = document.createElement('div');
        usageBadge.className = 'usage-badge';
        document.body.appendChild(usageBadge);
      }

      usageBadge.textContent = `${usageCount}/${DAILY_LIMIT}`;
      usageBadge.title = `You've used ${usageCount} out of your ${DAILY_LIMIT} daily analyses`;

      // Style for usage badge
      if (!document.querySelector('.usage-badge-style')) {
        const usageBadgeStyle = document.createElement('style');
        usageBadgeStyle.className = 'usage-badge-style';
        usageBadgeStyle.textContent = `
          .usage-badge {
            position: fixed;
            bottom: 20px;
            left: 20px;
            padding: 5px 10px;
            background-color: rgba(0,0,0,0.6);
            color: white;
            border-radius: 50px;
            font-size: 12px;
            z-index: 999;
            opacity: 0.7;
            transition: opacity 0.3s ease;
          }
          
          .usage-badge:hover {
            opacity: 1;
          }
        `;
        document.head.appendChild(usageBadgeStyle);
      }
    }
  }

  // Real-time rate limit tracking function
  async function updateRateLimitDisplay() {
    try {
      const response = await fetch('/get-rate-limits.php');
      const data = await response.json();

      // Update only the total usage badge
      let usageBadge = document.querySelector('.usage-badge');
      if (!usageBadge) {
        usageBadge = document.createElement('div');
        usageBadge.className = 'usage-badge';
        document.body.appendChild(usageBadge);
      }
      usageBadge.textContent = `${data.text.remaining}/${data.text.limit}`;

      // Remove any existing text or audio badges if they exist
      const textLimitBadge = document.querySelector('.text-limit-badge');
      if (textLimitBadge) {
        textLimitBadge.remove();
      }

      const audioLimitBadge = document.querySelector('.audio-limit-badge');
      if (audioLimitBadge) {
        audioLimitBadge.remove();
      }
    } catch (error) {
      console.error('Error updating rate limits:', error);
    }
  }

  // Update rate limits every 30 seconds
  setInterval(updateRateLimitDisplay, 30000);

  // Update the usage badge on page load
  updateUsageBadge();
  updateRateLimitDisplay();

  // Expose analyzeSentiment globally after it's defined
  window.analyzeSentiment = analyzeSentiment;
});