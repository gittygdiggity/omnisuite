// OmniBot AI — Content Script
// Injected into Google Meet & Zoom pages

(function () {
  'use strict';

  if (document.getElementById('omnibot-panel')) return;

  // ═══════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════
  let isListening = false;
  let recognition = null;
  let fullTranscript = '';
  let pendingTranscript = '';
  let analysisTimer = null;
  let analysisIntervalMs = 15000;
  let currentAnalysis = null;
  let transcriptVisible = false;
  let isMinimized = false;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  let lastClosingSignal = false; // track to chime only on new signals

  const LOGO_SVG = `<svg viewBox="0 0 24 24"><path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="currentColor"/><path d="M12 6L7 8.5V13.5L12 16L17 13.5V8.5L12 6Z" fill="rgba(0,0,0,0.3)"/><circle cx="12" cy="11" r="2" fill="rgba(0,0,0,0.5)"/></svg>`;
  const STEP_LABELS = ['WHY HERE', 'WHY YOU', 'PLAN', 'BLOCKERS', 'IDEAL', 'URGENCY'];

  // Closing signal chime — subtle two-tone ping via Web Audio API
  function playClosingChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // First tone — bright
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 880; // A5
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);

      // Second tone — resolution, slightly delayed
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1318.5; // E6
      gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.5);

      // Cleanup
      setTimeout(() => ctx.close(), 600);
    } catch (e) {
      // Audio context not available, fail silently
    }
  }

  // Load analysis interval from settings
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['analysis_interval'], (r) => {
      const val = parseInt(r.analysis_interval);
      if (val && val > 0) analysisIntervalMs = val * 1000;
    });
  }

  // ═══════════════════════════════════════════════
  // BUILD UI
  // ═══════════════════════════════════════════════
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'omnibot-panel';

    // The mini trigger is a SIBLING of the container, not inside it.
    // When minimized: container = hidden, trigger = visible.
    // When expanded: container = visible, trigger = hidden.
    panel.innerHTML = `
      <button class="omni-mini-trigger" id="omni-mini-trigger" title="Expand OmniBot">${LOGO_SVG}</button>

      <div class="omni-container" id="omni-container">
        <div class="omni-header" id="omni-header">
          <div class="omni-logo">${LOGO_SVG}</div>
          <div class="omni-header-content">
            <div class="omni-title">OmniBot AI</div>
            <div class="omni-subtitle">Live Intelligence</div>
          </div>
          <div class="omni-header-actions">
            <button class="omni-btn-icon" id="omni-btn-settings" title="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            </button>
            <button class="omni-btn-icon" id="omni-btn-minimize" title="Minimize">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>

        <div class="omni-body" id="omni-body">
          <div class="omni-status" id="omni-status">
            <div class="omni-status-dot inactive" id="omni-status-dot"></div>
            <span class="omni-status-text" id="omni-status-text">Ready — Start listening to begin</span>
          </div>

          <div class="omni-steps" id="omni-steps">
            ${STEP_LABELS.map((_, i) => `<div class="omni-step" data-step="${i + 1}"></div>`).join('')}
          </div>
          <div class="omni-step-labels">
            ${STEP_LABELS.map((l, i) => `<div class="omni-step-label" data-step="${i + 1}">${l}</div>`).join('')}
          </div>

          <div class="omni-cards" id="omni-cards">
            <div class="omni-empty" id="omni-empty">
              <div class="omni-empty-icon">🎯</div>
              <div class="omni-empty-title">Ready</div>
              <div class="omni-empty-text">Hit Start and begin your call.<br>OmniBot will coach you live.</div>
            </div>
          </div>

          <div class="omni-transcript-toggle" id="omni-transcript-toggle">
            <span>Live Transcript</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="omni-transcript-box" id="omni-transcript-box"></div>
        </div>

        <div class="omni-control-bar">
          <button class="omni-btn-primary omni-btn-start" id="omni-btn-toggle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            Start Listening
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    bindEvents(panel);
    return panel;
  }

  // ═══════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════
  function bindEvents(panel) {
    document.getElementById('omni-btn-toggle').addEventListener('click', toggleListening);

    // Minimize: hide container, show only green orb
    document.getElementById('omni-btn-minimize').addEventListener('click', () => {
      isMinimized = true;
      panel.classList.add('omni-minimized');
    });

    // Expand: show container, hide orb
    document.getElementById('omni-mini-trigger').addEventListener('click', (e) => {
      e.stopPropagation();
      if (isMinimized) {
        isMinimized = false;
        panel.classList.remove('omni-minimized');
      }
    });

    // Settings — delegate to background script (content scripts can't call openOptionsPage)
    document.getElementById('omni-btn-settings').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });

    // Transcript toggle
    document.getElementById('omni-transcript-toggle').addEventListener('click', () => {
      transcriptVisible = !transcriptVisible;
      document.getElementById('omni-transcript-box').classList.toggle('visible', transcriptVisible);
    });

    // Dragging
    const header = document.getElementById('omni-header');
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', endDrag);
  }

  // ═══════════════════════════════════════════════
  // DRAG
  // ═══════════════════════════════════════════════
  function startDrag(e) {
    if (e.target.closest('.omni-btn-icon')) return; // Don't drag when clicking buttons
    isDragging = true;
    const panel = document.getElementById('omnibot-panel');
    const rect = panel.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    panel.classList.add('dragging');
    e.preventDefault();
  }

  function doDrag(e) {
    if (!isDragging) return;
    const panel = document.getElementById('omnibot-panel');
    panel.style.left = (e.clientX - dragOffset.x) + 'px';
    panel.style.top = (e.clientY - dragOffset.y) + 'px';
    panel.style.right = 'auto';
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.getElementById('omnibot-panel').classList.remove('dragging');
  }

  // ═══════════════════════════════════════════════
  // SPEECH RECOGNITION
  // ═══════════════════════════════════════════════
  function toggleListening() {
    isListening ? stopListening() : startListening();
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      updateStatus('error', 'Speech Recognition not supported');
      return;
    }

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      updateStatus('listening', 'Listening — Speak naturally');
      updateToggleButton(true);
      chrome.runtime.sendMessage({ type: 'START_CALL' });
      const empty = document.getElementById('omni-empty');
      if (empty) empty.style.display = 'none';

      // Analysis loop at configured interval
      analysisTimer = setInterval(() => {
        if (pendingTranscript.trim()) sendForAnalysis();
      }, analysisIntervalMs);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t + ' ';
        } else {
          interim += t;
        }
      }

      if (final) {
        fullTranscript += final;
        pendingTranscript += final;
      }
      updateTranscriptBox(fullTranscript + interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      updateStatus('error', `Error: ${event.error}`);
    };

    recognition.onend = () => {
      if (isListening) {
        try { recognition.start(); } catch (e) { /* already started */ }
      }
    };

    try { recognition.start(); } catch (e) {
      updateStatus('error', 'Failed to start recognition');
    }
  }

  function stopListening() {
    isListening = false;
    if (recognition) { recognition.stop(); recognition = null; }
    if (analysisTimer) { clearInterval(analysisTimer); analysisTimer = null; }

    if (pendingTranscript.trim()) sendForAnalysis();

    updateStatus('inactive', 'Stopped — Call ended');
    updateToggleButton(false);

    chrome.runtime.sendMessage({ type: 'END_CALL' }, (response) => {
      if (response && response.summary) renderSummaryCard(response.summary);
    });
  }

  // ═══════════════════════════════════════════════
  // AI ANALYSIS
  // ═══════════════════════════════════════════════
  function sendForAnalysis() {
    const chunk = pendingTranscript;
    pendingTranscript = '';
    updateStatus('listening', 'Analyzing...');

    chrome.runtime.sendMessage(
      { type: 'ANALYZE_TRANSCRIPT', transcript: chunk, fullHistory: fullTranscript },
      (response) => {
        if (chrome.runtime.lastError) { updateStatus('error', 'Connection error'); return; }
        if (response && response.error) { updateStatus('error', response.error); return; }
        if (response && response.success) {
          currentAnalysis = response.analysis;
          renderAnalysis(response.analysis);
          updateStatus('listening', 'Listening — Active');
        }
      }
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  function renderAnalysis(a) {
    const cards = document.getElementById('omni-cards');
    updateStepTracker(a.current_step || 0);

    let html = '';

    // Closing signal — chime on new detection
    if (a.closing_signal && a.closing_move) {
      if (!lastClosingSignal) {
        playClosingChime();
      }
      lastClosingSignal = true;
      html += `
        <div class="omni-closing-alert">
          <div class="omni-closing-title">🚀 CLOSE NOW</div>
          <div class="omni-closing-text">${esc(a.closing_move)}</div>
        </div>`;
    } else {
      lastClosingSignal = false;
    }

    // Say This
    if (a.next_question) {
      html += `
        <div class="omni-card say-this">
          <div class="omni-card-header">
            <div class="omni-card-icon accent">💬</div>
            <div class="omni-card-title">Say This</div>
          </div>
          <div class="omni-say-text">"${esc(a.next_question)}"</div>
        </div>`;
    }

    // Strategy
    if (a.coaching_tip) {
      html += `
        <div class="omni-card">
          <div class="omni-card-header">
            <div class="omni-card-icon accent">🧠</div>
            <div class="omni-card-title">Strategy</div>
          </div>
          <div class="omni-card-body">${esc(a.coaching_tip)}</div>
        </div>`;
    }

    // Driver — neutral label, no sin references
    const driver = a.identified_driver || a.identified_sin;
    const confidence = a.driver_confidence || a.sin_confidence;
    if (driver && confidence !== 'low') {
      html += `
        <div class="omni-card">
          <div class="omni-card-header">
            <div class="omni-card-icon warning">🔮</div>
            <div class="omni-card-title">Prospect Read</div>
          </div>
          <div class="omni-card-body">
            <span class="omni-driver-badge">⚡ ${esc(driver)}</span>
            ${a.prospect_state ? `<div style="margin-top:6px">${esc(a.prospect_state)}</div>` : ''}
          </div>
        </div>`;
    }

    // Logical Fallacy
    if (a.logical_fallacy) {
      html += `
        <div class="omni-card">
          <div class="omni-card-header">
            <div class="omni-card-icon danger">⚠️</div>
            <div class="omni-card-title">Fallacy Detected</div>
          </div>
          <div class="omni-card-body">
            <strong>${esc(a.logical_fallacy)}</strong>
            ${a.fallacy_counter ? `<div style="margin-top:4px;color:var(--omni-accent)">${esc(a.fallacy_counter)}</div>` : ''}
          </div>
        </div>`;
    }

    // Danger Zone
    if (a.danger_zone) {
      html += `
        <div class="omni-card" style="border-color:rgba(255,77,106,0.2)">
          <div class="omni-card-header">
            <div class="omni-card-icon danger">🛑</div>
            <div class="omni-card-title">Watch Out</div>
          </div>
          <div class="omni-card-body" style="color:var(--omni-danger)">${esc(a.danger_zone)}</div>
        </div>`;
    }

    cards.innerHTML = html || '<div class="omni-empty"><div class="omni-empty-text">Listening...</div></div>';
  }

  function renderSummaryCard(summary) {
    const cards = document.getElementById('omni-cards');
    cards.innerHTML = `
      <div class="omni-card" style="border-color:rgba(0,229,160,0.2)">
        <div class="omni-card-header">
          <div class="omni-card-icon accent">📋</div>
          <div class="omni-card-title">Call Summary</div>
        </div>
        <div class="omni-card-body">${esc(summary).replace(/\n/g, '<br>')}</div>
      </div>`;
  }

  // ═══════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════
  function updateStatus(state, text) {
    const dot = document.getElementById('omni-status-dot');
    const txt = document.getElementById('omni-status-text');
    if (dot) dot.className = `omni-status-dot ${state}`;
    if (txt) txt.textContent = text;
  }

  function updateToggleButton(active) {
    const btn = document.getElementById('omni-btn-toggle');
    if (!btn) return;
    if (active) {
      btn.className = 'omni-btn-primary omni-btn-stop';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> Stop`;
    } else {
      btn.className = 'omni-btn-primary omni-btn-start';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Start Listening`;
    }
  }

  function updateStepTracker(step) {
    for (let i = 1; i <= 6; i++) {
      const s = document.querySelector(`.omni-step[data-step="${i}"]`);
      const l = document.querySelector(`.omni-step-label[data-step="${i}"]`);
      if (s) { s.classList.toggle('active', i === step); s.classList.toggle('completed', i < step); }
      if (l) { l.classList.toggle('active', i === step); }
    }
  }

  function updateTranscriptBox(text) {
    const box = document.getElementById('omni-transcript-box');
    if (box) { box.textContent = text; box.scrollTop = box.scrollHeight; }
  }

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════
  if (document.readyState === 'complete') {
    createPanel();
  } else {
    window.addEventListener('load', createPanel);
  }
})();
