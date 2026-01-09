# ToneAnalysis
AI Tone and Sentiment Analyzer - Automated Email Rewrite

# ToneAnalysis.com

---

## About

ToneAnalysis is a web application that analyzes, rewrites, and optimizes the tone of business emails using AI. 

**Three Modes:**
- **Draft Email:** Generate a complete email from a short prompt
- **Respond to Email:** Create appropriate responses to received emails
- **Analyze Only:** Get detailed tone and sentiment analysis

**Features:**
- Text input, file upload (TXT, PDF, DOCX), and voice recording
- Multiple tone options: Proofread, Professional, Formal, Casual, Friendly
- Real-time sentiment analysis with 7-section reports
- Rate limiting and security layers built-in

---

## Setup

1. Add your OpenAI API key to `config/config.php`
2. Upload files to your server
3. Done

---

## Known Issue

Occasionally (~5% of requests), the AI returns a non-standard format causing report sections to overlap. A page refresh (Ctrl+R) resolves this. This is an API response formatting issue, not a code bug.

---

## License

MIT Open-Source

---

## Contact

**Chad Wigington**

LinkedIn: https://www.linkedin.com/in/chadwigington/

GitHub: https://github.com/ChadsCode/ToneAnalysis

Website: https://www.toneanalysis.com/

---

Copyright (c) 2025 Chad Wigington
