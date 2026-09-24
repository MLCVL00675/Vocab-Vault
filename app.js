/**
 * VocabVault — English Vocabulary with Calendar, Active Recall & Spaced Repetition
 * Multi-Session Local Storage Engine with Cross-Tab Sync
 */

(function () {
  'use strict';

  // Storage Keys
  const STORAGE_KEY = 'vocabvault_words_v5';
  const THEME_KEY = 'vocabvault_theme_pref';
  const THRESHOLD_KEY = 'vocabvault_threshold_pref';
  const GEMINI_KEY_STORAGE = 'vocabvault_gemini_api_key';

  // State
  let words = [];
  let masteryThreshold = 5; // Default: 5 times to shift to Mastered
  let geminiApiKey = '';
  
  // Date filter state
  let dateFilterState = {
    type: 'all',
    startDate: null,
    endDate: null,
    label: 'All Dates'
  };

  let searchQuery = '';
  let statusFilter = 'all'; // 'all' | 'learning' | 'mastered'

  // Calendar State
  const now = new Date();
  let calViewYear = now.getFullYear();
  let calViewMonth = now.getMonth(); // 0-indexed

  // Flashcards practice state
  let fcFilteredList = [];
  let fcCurrentIndex = 0;
  let isFlipped = false;
  let practiceMode = 'word-to-meaning'; // 'word-to-meaning' | 'meaning-to-word'

  // Track expanded cards in list
  const revealedCardIds = new Set();
  let allRevealedState = false;

  // Robust Local Date Format Helpers (YYYY-MM-DD)
  const formatLocalISO = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayISO = () => formatLocalISO(new Date());
  const getRelativeDateISO = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return formatLocalISO(d);
  };

  const DEFAULT_SAMPLE_WORDS = [
    {
      id: 'w1',
      word: 'acquiesce',
      pos: 'Verb',
      date: getTodayISO(),
      meaning: 'to accept something reluctantly but without protest; to agree passively.',
      sentence: 'Sara decided to acquiesce in her manager\'s decision to avoid further conflict.',
      notes: 'Synonyms: consent, concur, comply, submit',
      streak: 1,
      mastered: false,
      createdAt: Date.now() - 10000
    },
    {
      id: 'w2',
      word: 'aberration',
      pos: 'Noun',
      date: getTodayISO(),
      meaning: 'a state or condition markedly different from the norm.',
      sentence: 'Her angry outburst was an aberration from her usual calm demeanor.',
      notes: 'Synonyms: anomaly, deviation, divergence',
      streak: 2,
      mastered: false,
      createdAt: Date.now() - 9500
    },
    {
      id: 'w3',
      word: 'ephemeral',
      pos: 'Adjective',
      date: getTodayISO(),
      meaning: 'lasting for a very short time; fleeting or transient.',
      sentence: 'The beauty of the morning mist over the lake is notoriously ephemeral.',
      notes: 'Synonyms: momentary, evanescent, fleeting',
      streak: 0,
      mastered: false,
      createdAt: Date.now() - 9000
    },
    {
      id: 'w4',
      word: 'serendipity',
      pos: 'Noun',
      date: getTodayISO(),
      meaning: 'the occurrence and development of events by chance in a happy or beneficial way.',
      sentence: 'Finding my dream internship through a casual coffee conversation was pure serendipity.',
      notes: 'Synonyms: fluke, happy accident, good fortune',
      streak: 3,
      mastered: true,
      createdAt: Date.now() - 8000
    },
    {
      id: 'w5',
      word: 'ubiquitous',
      pos: 'Adjective',
      date: getRelativeDateISO(1),
      meaning: 'present, appearing, or found everywhere at the same time.',
      sentence: 'Smartphones have become ubiquitous across all age groups in modern society.',
      notes: 'Synonyms: omnipresent, pervasive, universal',
      streak: 0,
      mastered: false,
      createdAt: Date.now() - 90000
    },
    {
      id: 'w6',
      word: 'resilient',
      pos: 'Adjective',
      date: getRelativeDateISO(1),
      meaning: 'able to withstand or recover quickly from difficult conditions or hardship.',
      sentence: 'The local community proved remarkably resilient following the unexpected storm.',
      notes: 'Synonyms: robust, tough, hardy',
      streak: 3,
      mastered: true,
      createdAt: Date.now() - 85000
    },
    {
      id: 'w7',
      word: 'eloquent',
      pos: 'Adjective',
      date: getRelativeDateISO(3),
      meaning: 'fluent, persuasive, or clearly expressing powerful ideas in speech or writing.',
      sentence: 'Her eloquent presentation on renewable energy received a standing ovation.',
      notes: 'Synonyms: articulate, expressive, persuasive',
      streak: 1,
      mastered: false,
      createdAt: Date.now() - 250000
    }
  ];

  function getPosAbbr(pos) {
    switch ((pos || '').toLowerCase()) {
      case 'noun': return 'n.';
      case 'verb': return 'v.';
      case 'adjective': return 'adj.';
      case 'adverb': return 'adv.';
      case 'idiom': return 'idiom.';
      case 'phrasal verb': return 'phr. v.';
      default: return '';
    }
  }

  // DOM Elements
  const totalCountBadge = document.getElementById('totalCountBadge');
  const masteredCountBadge = document.getElementById('masteredCountBadge');
  const learningCountBadge = document.getElementById('learningCountBadge');
  const todayCountBadge = document.getElementById('todayCountBadge');
  const thresholdDisplayNum = document.getElementById('thresholdDisplayNum');

  // Calendar DOM
  const calMonthYearTitle = document.getElementById('calMonthYearTitle');
  const calPrevMonthBtn = document.getElementById('calPrevMonthBtn');
  const calNextMonthBtn = document.getElementById('calNextMonthBtn');
  const calDaysGrid = document.getElementById('calDaysGrid');
  
  // Preset Range Buttons
  const calFilterAllBtn = document.getElementById('calFilterAllBtn');
  const calFilterTodayBtn = document.getElementById('calFilterTodayBtn');
  const calFilterLast7Btn = document.getElementById('calFilterLast7Btn');
  const calFilterLast30Btn = document.getElementById('calFilterLast30Btn');
  const calFilterThisMonthBtn = document.getElementById('calFilterThisMonthBtn');

  // Custom Range Box DOM
  const toggleRangePickerBtn = document.getElementById('toggleRangePickerBtn');
  const rangeInputsContainer = document.getElementById('rangeInputsContainer');
  const rangeStartDate = document.getElementById('rangeStartDate');
  const rangeEndDate = document.getElementById('rangeEndDate');
  const applyRangeBtn = document.getElementById('applyRangeBtn');
  const clearRangeBtn = document.getElementById('clearRangeBtn');

  // List & Search DOM
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterPills = document.querySelectorAll('.filter-pill');
  const toggleAllRevealBtn = document.getElementById('toggleAllRevealBtn');
  const toggleAllRevealText = document.getElementById('toggleAllRevealText');
  const activeFilterBanner = document.getElementById('activeFilterBanner');
  const filterBannerDateText = document.getElementById('filterBannerDateText');
  const filterBannerCountBadge = document.getElementById('filterBannerCountBadge');
  const clearCalendarFilterBtn = document.getElementById('clearCalendarFilterBtn');
  const feedSection = document.getElementById('feedSection');
  const emptyState = document.getElementById('emptyState');
  const emptyAddBtn = document.getElementById('emptyAddBtn');

  // Flashcards Modal DOM
  const openFlashcardModalBtn = document.getElementById('openFlashcardModalBtn');
  const flashcardModalBackdrop = document.getElementById('flashcardModalBackdrop');
  const closeFlashcardModalBtn = document.getElementById('closeFlashcardModalBtn');
  const fcModalDateChip = document.getElementById('fcModalDateChip');
  const fcPracticeModeSelect = document.getElementById('fcPracticeModeSelect');
  const fcPracticeDateSelect = document.getElementById('fcPracticeDateSelect');
  const fcPracticeStatusSelect = document.getElementById('fcPracticeStatusSelect');
  const fcCustomRangeWrap = document.getElementById('fcCustomRangeWrap');
  const fcCustomStart = document.getElementById('fcCustomStart');
  const fcCustomEnd = document.getElementById('fcCustomEnd');
  const fcApplyCustomRangeBtn = document.getElementById('fcApplyCustomRangeBtn');

  const mainDeckCard = document.getElementById('mainDeckCard');
  const fcMainWord = document.getElementById('fcMainWord');
  const fcReversePrompt = document.getElementById('fcReversePrompt');
  const fcPronunciationGroup = document.getElementById('fcPronunciationGroup');
  const fcSpeakUsBtn = document.getElementById('fcSpeakUsBtn');
  const fcSpeakUkBtn = document.getElementById('fcSpeakUkBtn');
  const fcBackAnswerTitle = document.getElementById('fcBackAnswerTitle');
  const fcBackPosAbbr = document.getElementById('fcBackPosAbbr');
  const fcBackMeaning = document.getElementById('fcBackMeaning');
  const fcBackSentence = document.getElementById('fcBackSentence');
  const fcBackSentenceWrap = document.getElementById('fcBackSentenceWrap');
  const fcBackNotes = document.getElementById('fcBackNotes');
  const fcBackNotesWrapper = document.getElementById('fcBackNotesWrapper');

  const fcStreakPips = document.getElementById('fcStreakPips');
  const fcStreakScoreBadge = document.getElementById('fcStreakScoreBadge');
  const fcCardStatusPill = document.getElementById('fcCardStatusPill');
  const fcGradeWrongBtn = document.getElementById('fcGradeWrongBtn');
  const fcGradeRightBtn = document.getElementById('fcGradeRightBtn');

  const fcPrevBtn = document.getElementById('fcPrevBtn');
  const fcNextBtn = document.getElementById('fcNextBtn');
  const fcShuffleBtn = document.getElementById('fcShuffleBtn');
  const fcCurrentIndexEl = document.getElementById('fcCurrentIndex');
  const fcTotalCountEl = document.getElementById('fcTotalCount');

  // Word Modal DOM
  const addWordBtn = document.getElementById('addWordBtn');
  const wordModalBackdrop = document.getElementById('wordModalBackdrop');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const wordForm = document.getElementById('wordForm');
  const modalTitle = document.getElementById('modalTitle');
  const editWordId = document.getElementById('editWordId');
  const wordInput = document.getElementById('wordInput');
  const posSelect = document.getElementById('posSelect');
  const dateInput = document.getElementById('dateInput');
  const statusSelect = document.getElementById('statusSelect');
  const meaningInput = document.getElementById('meaningInput');
  const sentenceInput = document.getElementById('sentenceInput');
  const notesInput = document.getElementById('notesInput');

  // AI Quick Add DOM
  const aiQuickAddForm = document.getElementById('aiQuickAddForm');
  const aiQuickWordInput = document.getElementById('aiQuickWordInput');
  const aiQuickAddBtn = document.getElementById('aiQuickAddBtn');
  const triggerAiAutoFillBtn = document.getElementById('triggerAiAutoFillBtn');
  const aiInlineSpinner = document.getElementById('aiInlineSpinner');
  const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');

  // Settings DOM
  const masteryThresholdSelect = document.getElementById('masteryThresholdSelect');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModalBackdrop = document.getElementById('settingsModalBackdrop');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsDoneBtn = document.getElementById('saveSettingsDoneBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataBtn = document.getElementById('importDataBtn');
  const importFileInput = document.getElementById('importFileInput');
  const loadSampleDataBtn = document.getElementById('loadSampleDataBtn');
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Custom Confirmation Modal DOM
  const confirmModalBackdrop = document.getElementById('confirmModalBackdrop');
  const confirmModalIcon = document.getElementById('confirmModalIcon');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalDesc = document.getElementById('confirmModalDesc');
  const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');
  const confirmModalActionBtn = document.getElementById('confirmModalActionBtn');

  let activeConfirmCallback = null;

  /* ==========================================================================
     Storage & Persistence Engine
     ========================================================================== */

  function loadWordsFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seen = new Set();
          const deduplicated = [];

          parsed.forEach((item) => {
            const wordKey = (item.word || '').trim().toLowerCase();
            if (!wordKey || seen.has(wordKey)) return;
            seen.add(wordKey);

            deduplicated.push({
              ...item,
              word: item.word ? item.word.trim() : '',
              pos: item.pos || 'Noun',
              meaning: item.meaning || '',
              sentence: item.sentence || '',
              notes: item.notes || '',
              streak: typeof item.streak === 'number' ? item.streak : (item.mastered ? masteryThreshold : 0),
              wrongCount: typeof item.wrongCount === 'number' ? item.wrongCount : 0
            });
          });

          words = deduplicated;
          updateStatsHeader();
          saveWordsToStorage();
          return;
        }
      }
    } catch (err) {
      console.error('Failed to parse localStorage data:', err);
    }
    words = [...DEFAULT_SAMPLE_WORDS];
    saveWordsToStorage();
  }

  function loadThresholdFromStorage() {
    const saved = localStorage.getItem(THRESHOLD_KEY);
    if (saved) {
      masteryThreshold = parseInt(saved, 10) || 5;
    }
    if (masteryThresholdSelect) masteryThresholdSelect.value = masteryThreshold.toString();
    if (thresholdDisplayNum) thresholdDisplayNum.textContent = `${masteryThreshold} times`;
  }

  function saveWordsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      updateStatsHeader();
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
      showToast('Error saving to local storage', 'error');
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      loadWordsFromStorage();
      renderCalendar();
      renderEntries();
      showToast('Vault updated from another window', 'info');
    }
  });

  /* ==========================================================================
     Theme Management
     ========================================================================== */

  function updateThemeButtonTooltip(theme) {
    if (themeToggleBtn) {
      themeToggleBtn.title = theme === 'dark' 
        ? 'Current: Dark Mode (Click for Light Mode)' 
        : 'Current: Light Mode (Click for Dark Mode)';
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButtonTooltip(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeButtonTooltip(next);
    showToast(`Switched to ${next} theme`, 'info');
  }

  /* ==========================================================================
     Stats Header
     ========================================================================== */

  function updateStatsHeader() {
    if (totalCountBadge) totalCountBadge.textContent = words.length;
    const masteredCount = words.filter((w) => w.mastered).length;
    if (masteredCountBadge) masteredCountBadge.textContent = masteredCount;
    if (learningCountBadge) learningCountBadge.textContent = words.length - masteredCount;
    
    const today = getTodayISO();
    if (todayCountBadge) todayCountBadge.textContent = words.filter((w) => w.date === today).length;
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return 'No Date';
    const today = getTodayISO();
    const yesterday = getRelativeDateISO(1);

    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(year, month - 1, day);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const formatted = dateObj.toLocaleDateString(undefined, options);

    if (dateStr === today) {
      return `Today — ${formatted}`;
    } else if (dateStr === yesterday) {
      return `Yesterday — ${formatted}`;
    }
    return formatted;
  }

  /* ==========================================================================
     DATE RANGE & CALENDAR ENGINE
     ========================================================================== */

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function renderCalendar() {
    if (!calMonthYearTitle || !calDaysGrid) return;

    calMonthYearTitle.textContent = `${MONTH_NAMES[calViewMonth]} ${calViewYear}`;

    const firstDayIndex = new Date(calViewYear, calViewMonth, 1).getDay();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

    const dateCountMap = {};
    words.forEach((w) => {
      if (w.date) {
        dateCountMap[w.date] = (dateCountMap[w.date] || 0) + 1;
      }
    });

    calDaysGrid.innerHTML = '';

    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell empty-day';
      calDaysGrid.appendChild(emptyCell);
    }

    const todayStr = getTodayISO();

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      cell.textContent = day;

      const monthPad = String(calViewMonth + 1).padStart(2, '0');
      const dayPad = String(day).padStart(2, '0');
      const cellDateISO = `${calViewYear}-${monthPad}-${dayPad}`;

      cell.dataset.date = cellDateISO;

      if (cellDateISO === todayStr) {
        cell.classList.add('is-today');
      }

      // Check if Selected or in Range
      if (dateFilterState.type === 'single' && dateFilterState.startDate === cellDateISO) {
        cell.classList.add('selected');
      } else if (dateFilterState.type === 'range') {
        if (cellDateISO === dateFilterState.startDate || cellDateISO === dateFilterState.endDate) {
          cell.classList.add('selected');
        } else if (cellDateISO > dateFilterState.startDate && cellDateISO < dateFilterState.endDate) {
          cell.classList.add('in-range');
        }
      }

      const wordCount = dateCountMap[cellDateISO] || 0;
      if (wordCount > 0) {
        cell.classList.add('has-words');
        cell.title = `${wordCount} words on ${cellDateISO}`;
      }

      cell.addEventListener('click', () => {
        if (dateFilterState.type === 'single' && dateFilterState.startDate === cellDateISO) {
          setDateFilter('all', null, null, 'All Dates');
        } else {
          setDateFilter('single', cellDateISO, cellDateISO, formatDateDisplay(cellDateISO));
        }
      });

      calDaysGrid.appendChild(cell);
    }

    updatePresetButtonsState();
  }

  function setDateFilter(type, start, end, label) {
    dateFilterState = {
      type,
      startDate: start,
      endDate: end,
      label: label || 'Custom Filter'
    };
    renderCalendar();
    renderEntries();
  }

  function updatePresetButtonsState() {
    const today = getTodayISO();
    const last7 = getRelativeDateISO(7);
    const last30 = getRelativeDateISO(30);

    if (calFilterAllBtn) calFilterAllBtn.classList.toggle('active', dateFilterState.type === 'all');
    if (calFilterTodayBtn) calFilterTodayBtn.classList.toggle('active', dateFilterState.type === 'single' && dateFilterState.startDate === today);
    if (calFilterLast7Btn) calFilterLast7Btn.classList.toggle('active', dateFilterState.type === 'range' && dateFilterState.startDate === last7 && dateFilterState.endDate === today);
    if (calFilterLast30Btn) calFilterLast30Btn.classList.toggle('active', dateFilterState.type === 'range' && dateFilterState.startDate === last30 && dateFilterState.endDate === today);
    if (calFilterThisMonthBtn) calFilterThisMonthBtn.classList.toggle('active', dateFilterState.type === 'range' && (dateFilterState.label || '').startsWith('This Month'));
  }

  /* ==========================================================================
     DATE LIST / ENTRIES RENDERING
     ========================================================================== */

  function renderEntries() {
    const q = searchQuery.trim().toLowerCase();

    const filtered = words.filter((item) => {
      // 1. Search matching
      if (q) {
        const matchWord = (item.word || '').toLowerCase().includes(q);
        const matchMeaning = (item.meaning || '').toLowerCase().includes(q);
        const matchSentence = (item.sentence || '').toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchWord && !matchMeaning && !matchSentence && !matchNotes) return false;
      }

      // 2. Status matching (Threshold-based)
      if (statusFilter === 'learning' && item.mastered) return false;
      if (statusFilter === 'mastered' && !item.mastered) return false;

      // 3. Date / Range matching
      if (dateFilterState.type === 'single') {
        if (item.date !== dateFilterState.startDate) return false;
      } else if (dateFilterState.type === 'range') {
        if (!item.date || item.date < dateFilterState.startDate || item.date > dateFilterState.endDate) return false;
      }

      return true;
    });

    if (activeFilterBanner && filterBannerDateText && filterBannerCountBadge) {
      if (dateFilterState.type !== 'all') {
        activeFilterBanner.style.display = 'flex';
        filterBannerDateText.textContent = dateFilterState.label;
        filterBannerCountBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'word' : 'words'}`;
      } else {
        activeFilterBanner.style.display = 'none';
      }
    }

    if (!feedSection) return;

    if (filtered.length === 0) {
      feedSection.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const groups = {};
    filtered.forEach((w) => {
      const d = w.date || 'Undated';
      if (!groups[d]) groups[d] = [];
      groups[d].push(w);
    });

    const sortedDates = Object.keys(groups).sort().reverse();

    feedSection.innerHTML = '';

    sortedDates.forEach((dateKey) => {
      const groupWords = groups[dateKey];
      const groupEl = document.createElement('div');
      groupEl.className = 'date-group';

      const dateLabel = formatDateDisplay(dateKey);
      
      groupEl.innerHTML = `
        <div class="date-group-header">
          <div class="date-group-title">
            <span>📅 ${escapeHtml(dateLabel)}</span>
            <span class="date-badge">${groupWords.length} ${groupWords.length === 1 ? 'word' : 'words'}</span>
          </div>
          <div class="date-group-actions">
            <button class="date-action-btn" data-action="toggle-day" data-date="${escapeHtml(dateKey)}">
              Reveal / Hide Day
            </button>
          </div>
        </div>
        <div class="words-grid" id="grid-${escapeHtml(dateKey)}"></div>
      `;

      const gridEl = groupEl.querySelector('.words-grid');

      groupWords.forEach((wordItem) => {
        const cardEl = createWordCardElement(wordItem);
        gridEl.appendChild(cardEl);
      });

      feedSection.appendChild(groupEl);
    });
  }

  function createWordCardElement(item) {
    const card = document.createElement('div');
    const isUnhidden = revealedCardIds.has(item.id);
    const isMastered = !!item.mastered;
    const streak = item.streak || 0;
    const wrongCount = item.wrongCount || 0;

    card.className = `word-card ${isMastered ? 'mastered' : ''}`;
    card.id = `card-${item.id}`;

    const posClean = (item.pos || 'Other').replace(/\s+/g, '-');
    const abbr = getPosAbbr(item.pos);

    // Build streak pips HTML (e.g. 3 dots)
    let pipsHtml = '';
    for (let i = 1; i <= masteryThreshold; i++) {
      pipsHtml += `<span class="pip ${i <= streak ? 'filled' : ''}"></span>`;
    }

    card.innerHTML = `
      <div class="card-top-row">
        <div class="card-word-title-wrap">
          <span class="card-word-name">${escapeHtml(item.word)}</span>
          <span class="pos-tag ${posClean}">${escapeHtml(item.pos || 'Word')}</span>
        </div>
        
        <div class="card-actions-group">
          <button class="btn-speak-sm" data-action="speak" data-word="${escapeHtml(item.word)}" title="Listen to pronunciation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          </button>

          <button class="action-btn-subtle" data-action="edit" data-id="${item.id}" title="Edit word">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>

          <button class="action-btn-subtle" data-action="delete" data-id="${item.id}" title="Delete word">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Hidden Box for Active Recall (Click anywhere to toggle hide/unhide) -->
      <div class="hidden-details-container ${isUnhidden ? 'unhidden' : ''}" id="details-${item.id}" data-action="toggle-details" data-id="${item.id}" title="${isUnhidden ? 'Click anywhere to hide' : 'Click anywhere to reveal'}">
        <!-- Masked Button -->
        <div class="reveal-curtain-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>Tap anywhere to reveal Meaning & Sentence</span>
        </div>

        <!-- Unhidden Content -->
        <div class="revealed-content">
          <div class="detail-section">
            <span class="detail-label">Meaning:</span>
            <p class="detail-text-meaning"><strong>${abbr ? `${abbr} ` : ''}</strong>${escapeHtml(item.meaning)}</p>
          </div>

          <div class="detail-section">
            <span class="detail-label">Example Sentence:</span>
            <p class="detail-text-sentence">"${escapeHtml(item.sentence)}"</p>
          </div>

          ${item.notes && item.notes.trim() ? `
            <div class="detail-section">
              <p class="detail-text-notes"><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>
            </div>
          ` : ''}

          <div class="card-hide-btn-row">
            <span class="card-hide-btn" data-action="hide" data-id="${item.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                <line x1="2" y1="2" x2="22" y2="22"></line>
              </svg>
              Tap anywhere to hide
            </span>
          </div>
        </div>
      </div>

      <!-- Card Footer with Streak & Quick Recall Ticks/Crosses -->
      <div class="card-bottom-bar">
        <div class="streak-meta-wrap">
          <span class="streak-lbl">Streak:</span>
          <div class="streak-pips" title="Mastery Streak: ${streak} ${streak === 1 ? 'time' : 'times'}">${pipsHtml}</div>
          <span class="streak-count-text ${isMastered ? 'mastered' : ''}">${streak} ${streak === 1 ? 'time' : 'times'}</span>
          <span class="wrong-count-text ${wrongCount > 0 ? '' : 'hidden-zero'}" title="Forgotten: ${wrongCount} ${wrongCount === 1 ? 'time' : 'times'}">✕ ${wrongCount} ${wrongCount === 1 ? 'time' : 'times'}</span>
        </div>
        
        <div class="card-recall-actions">
          <button class="quick-recall-btn btn-wrong" data-action="grade-wrong-inline" data-id="${item.id}" title="Forgot (Resets streak & increments wrong count)">✕</button>
          <button class="quick-recall-btn btn-right" data-action="grade-right-inline" data-id="${item.id}" title="Remembered! (+1 Streak toward Mastered)">✓</button>
        </div>
      </div>
    `;

    return card;
  }

  /* ==========================================================================
     Confetti Celebration Engine
     ========================================================================== */

  function triggerConfetti(originX, originY) {
    let canvas = document.getElementById('confettiCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confettiCanvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '999999';
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#fbbf24', '#ffffff'];
    const particles = [];
    const count = 100;

    const startX = typeof originX === 'number' ? originX : canvas.width / 2;
    const startY = typeof originY === 'number' ? originY : canvas.height * 0.45;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 4;
      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 6 + 3),
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.random() * 0.1 + 0.05,
        opacity: 1,
        shape: Math.random() > 0.4 ? 'rect' : 'circle'
      });
    }

    let animationId;
    let startTime = performance.now();

    function renderConfetti(currentTime) {
      const elapsed = (currentTime - startTime) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let activeCount = 0;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.32; // gravity
        p.vx *= 0.98; // friction
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        if (elapsed > 1.0) {
          p.opacity -= 0.025;
        }

        if (p.opacity > 0 && p.y < canvas.height + 50) {
          activeCount++;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);

          ctx.fillStyle = p.color;
          if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (0.6 + Math.sin(p.wobble) * 0.4));
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (activeCount > 0 && elapsed < 3.0) {
        animationId = requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animationId);
      }
    }

    animationId = requestAnimationFrame(renderConfetti);
  }

  function updateCardDOM(item) {
    const cardEl = document.getElementById(`card-${item.id}`);
    if (!cardEl) return;

    const isMastered = !!item.mastered;
    const streak = item.streak || 0;
    const wrongCount = item.wrongCount || 0;

    cardEl.classList.toggle('mastered', isMastered);

    // In-place update of streak pips (filled up to threshold)
    const pipsContainer = cardEl.querySelector('.streak-pips');
    if (pipsContainer) {
      let pipsHtml = '';
      for (let i = 1; i <= masteryThreshold; i++) {
        pipsHtml += `<span class="pip ${i <= streak ? 'filled' : ''}"></span>`;
      }
      pipsContainer.innerHTML = pipsHtml;
      pipsContainer.title = `Mastery Streak: ${streak} ${streak === 1 ? 'time' : 'times'}`;
    }

    // In-place update of streak count text beside the pips (e.g. "3 times", "4 times", "10 times"...)
    const countText = cardEl.querySelector('.streak-count-text');
    if (countText) {
      countText.textContent = `${streak} ${streak === 1 ? 'time' : 'times'}`;
      countText.className = `streak-count-text ${isMastered ? 'mastered' : ''}`;
    }

    // In-place update of wrong count text
    const wrongCountText = cardEl.querySelector('.wrong-count-text');
    if (wrongCountText) {
      wrongCountText.textContent = `✕ ${wrongCount} ${wrongCount === 1 ? 'time' : 'times'}`;
      wrongCountText.title = `Forgotten: ${wrongCount} ${wrongCount === 1 ? 'time' : 'times'}`;
      wrongCountText.classList.toggle('hidden-zero', wrongCount === 0);
    }

    // If an exclusive status filter is active, smoothly animate out if category changed
    if (statusFilter === 'learning' && isMastered) {
      cardEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.95)';
      setTimeout(() => renderEntries(), 250);
    } else if (statusFilter === 'mastered' && !isMastered) {
      cardEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.95)';
      setTimeout(() => renderEntries(), 250);
    }
  }

  function applyWordGrading(wordId, isCorrect) {
    const item = words.find((w) => w.id === wordId);
    if (!item) return;

    const wasMastered = !!item.mastered;

    if (isCorrect) {
      item.streak = (item.streak || 0) + 1;
      
      if (item.streak >= masteryThreshold) {
        item.mastered = true;
        if (!wasMastered) {
          const cardEl = document.getElementById(`card-${item.id}`);
          if (cardEl) {
            const rect = cardEl.getBoundingClientRect();
            triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
          } else {
            triggerConfetti();
          }
        }
      }
    } else {
      item.streak = 0;
      item.mastered = false;
      item.wrongCount = (item.wrongCount || 0) + 1;
    }

    saveWordsToStorage();
    updateCardDOM(item);
  }

  function toggleDayDetails(dateKey) {
    const dayWords = words.filter((w) => w.date === dateKey);
    const anyHidden = dayWords.some((w) => !revealedCardIds.has(w.id));

    dayWords.forEach((w) => {
      const container = document.getElementById(`details-${w.id}`);
      if (anyHidden) {
        revealedCardIds.add(w.id);
        if (container) container.classList.add('unhidden');
      } else {
        revealedCardIds.delete(w.id);
        if (container) container.classList.remove('unhidden');
      }
    });
  }

  function toggleAllDetails() {
    allRevealedState = !allRevealedState;
    if (allRevealedState) {
      words.forEach((w) => revealedCardIds.add(w.id));
      if (toggleAllRevealText) toggleAllRevealText.textContent = 'Hide All';
    } else {
      revealedCardIds.clear();
      if (toggleAllRevealText) toggleAllRevealText.textContent = 'Reveal All';
    }
    renderEntries();
  }

  /* ==========================================================================
     FLASHCARD ACTIVE RECALL & TICK/CROSS GRADING ENGINE
     ========================================================================== */

  function getFlashcardWords() {
    const dateVal = fcPracticeDateSelect ? fcPracticeDateSelect.value : 'all';
    const statusVal = fcPracticeStatusSelect ? fcPracticeStatusSelect.value : 'all';
    const today = getTodayISO();
    const yesterday = getRelativeDateISO(1);
    const last7 = getRelativeDateISO(7);
    const last14 = getRelativeDateISO(14);
    const last30 = getRelativeDateISO(30);

    return words.filter((w) => {
      // Date filter
      if (dateVal === 'today' && w.date !== today) return false;
      if (dateVal === 'yesterday' && w.date !== yesterday) return false;
      if (dateVal === 'last7' && (!w.date || w.date < last7)) return false;
      if (dateVal === 'last14' && (!w.date || w.date < last14)) return false;
      if (dateVal === 'last30' && (!w.date || w.date < last30)) return false;
      if (dateVal === 'thisMonth') {
        const thisMonthPrefix = today.substring(0, 7);
        if (!w.date || !w.date.startsWith(thisMonthPrefix)) return false;
      }
      if (dateVal === 'custom' && fcCustomStart && fcCustomEnd) {
        const s = fcCustomStart.value;
        const e = fcCustomEnd.value;
        if (s && w.date < s) return false;
        if (e && w.date > e) return false;
      }

      // Status filter
      if (statusVal === 'learning' && w.mastered) return false;
      if (statusVal === 'mastered' && !w.mastered) return false;

      return true;
    });
  }

  function openFlashcardModal() {
    if (fcPracticeDateSelect) {
      if (dateFilterState.type === 'single') {
        fcPracticeDateSelect.value = dateFilterState.startDate === getTodayISO() ? 'today' : 'all';
      } else if (dateFilterState.type === 'range') {
        fcPracticeDateSelect.value = 'all';
      }
    }

    refreshFlashcards(true);

    if (fcFilteredList.length === 0) {
      showToast('No words found to practice for this filter.', 'info');
      return;
    }

    if (flashcardModalBackdrop) {
      flashcardModalBackdrop.classList.add('open');
      flashcardModalBackdrop.setAttribute('aria-hidden', 'false');
    }
  }

  function closeFlashcardModal() {
    if (flashcardModalBackdrop) {
      flashcardModalBackdrop.classList.remove('open');
      flashcardModalBackdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function refreshFlashcards(resetIndex = false) {
    fcFilteredList = getFlashcardWords();
    if (resetIndex || fcCurrentIndex >= fcFilteredList.length) {
      fcCurrentIndex = 0;
    }
    renderActiveFlashcard();
  }

  function renderActiveFlashcard() {
    isFlipped = false;
    if (mainDeckCard) mainDeckCard.classList.remove('flipped');

    if (fcFilteredList.length === 0) {
      if (fcMainWord) fcMainWord.textContent = 'No words match';
      if (fcCurrentIndexEl) fcCurrentIndexEl.textContent = '0';
      if (fcTotalCountEl) fcTotalCountEl.textContent = '0';
      return;
    }

    const count = fcFilteredList.length;
    const l1 = document.querySelector('.deck-card-layer.layer-back-1');
    if (l1) l1.style.display = count > 1 ? 'block' : 'none';
    const l2 = document.querySelector('.deck-card-layer.layer-back-2');
    if (l2) l2.style.display = count > 2 ? 'block' : 'none';
    const l3 = document.querySelector('.deck-card-layer.layer-back-3');
    if (l3) l3.style.display = count > 3 ? 'block' : 'none';

    const item = fcFilteredList[fcCurrentIndex];
    if (!item) return;
    const streak = item.streak || 0;

    // Update Streak Pips
    if (fcStreakPips) {
      fcStreakPips.innerHTML = '';
      for (let i = 1; i <= masteryThreshold; i++) {
        const pip = document.createElement('span');
        pip.className = `pip ${i <= streak ? 'filled' : ''}`;
        fcStreakPips.appendChild(pip);
      }
    }
    if (fcStreakScoreBadge) fcStreakScoreBadge.textContent = `${streak} ${streak === 1 ? 'time' : 'times'}`;

    // Update status badge
    if (fcCardStatusPill) {
      fcCardStatusPill.textContent = item.mastered ? 'Mastered 🟢' : 'Learning 🟡';
      fcCardStatusPill.className = `card-status-pill-small ${item.mastered ? 'mastered' : ''}`;
    }

    const abbr = getPosAbbr(item.pos);

    if (practiceMode === 'word-to-meaning') {
      // Prompt = Word, Answer = Meaning + Sentence
      if (fcMainWord) {
        fcMainWord.style.display = 'block';
        fcMainWord.textContent = item.word;
      }
      if (fcReversePrompt) fcReversePrompt.style.display = 'none';
      if (fcPronunciationGroup) fcPronunciationGroup.style.display = 'flex';
      if (fcBackAnswerTitle) fcBackAnswerTitle.style.display = 'none';

      if (fcBackPosAbbr) fcBackPosAbbr.textContent = abbr ? `${abbr} ` : '';
      if (fcBackMeaning) fcBackMeaning.textContent = item.meaning;
    } else {
      // Reverse Recall: Prompt = Definition + Sentence with blank, Answer = Word
      if (fcMainWord) fcMainWord.style.display = 'none';
      if (fcPronunciationGroup) fcPronunciationGroup.style.display = 'none';
      if (fcReversePrompt) {
        fcReversePrompt.style.display = 'block';

        let maskedSentence = item.sentence || '';
        if (item.word && maskedSentence) {
          const regex = new RegExp(`\\b${item.word}\\b`, 'gi');
          maskedSentence = maskedSentence.replace(regex, '________');
        }

        fcReversePrompt.innerHTML = `
          <div style="font-weight:700; font-size:1.15rem; margin-bottom:6px;"><strong>${abbr ? `${abbr} ` : ''}</strong>${escapeHtml(item.meaning)}</div>
          <div style="font-style:italic; font-size:0.9rem; color:#64748b;">"${escapeHtml(maskedSentence)}"</div>
        `;
      }

      if (fcBackAnswerTitle) {
        fcBackAnswerTitle.style.display = 'block';
        fcBackAnswerTitle.textContent = item.word;
      }
      if (fcBackPosAbbr) fcBackPosAbbr.textContent = abbr ? `${abbr} ` : '';
      if (fcBackMeaning) fcBackMeaning.textContent = item.meaning;
    }

    if (item.sentence && item.sentence.trim()) {
      if (fcBackSentenceWrap) fcBackSentenceWrap.style.display = 'block';
      if (fcBackSentence) fcBackSentence.textContent = `"${item.sentence}"`;
    } else {
      if (fcBackSentenceWrap) fcBackSentenceWrap.style.display = 'none';
    }

    if (item.notes && item.notes.trim()) {
      if (fcBackNotesWrapper) fcBackNotesWrapper.style.display = 'block';
      if (fcBackNotes) fcBackNotes.textContent = item.notes;
    } else {
      if (fcBackNotesWrapper) fcBackNotesWrapper.style.display = 'none';
    }

    if (fcCurrentIndexEl) fcCurrentIndexEl.textContent = (fcCurrentIndex + 1).toString();
    if (fcTotalCountEl) fcTotalCountEl.textContent = fcFilteredList.length.toString();
    if (fcModalDateChip) fcModalDateChip.textContent = `${fcFilteredList.length} words`;
  }

  function flipFlashcard() {
    isFlipped = !isFlipped;
    if (mainDeckCard) mainDeckCard.classList.toggle('flipped', isFlipped);
  }

  function nextFlashcard() {
    if (fcFilteredList.length <= 1) return;
    fcCurrentIndex = (fcCurrentIndex + 1) % fcFilteredList.length;
    renderActiveFlashcard();
  }

  function prevFlashcard() {
    if (fcFilteredList.length <= 1) return;
    fcCurrentIndex = (fcCurrentIndex - 1 + fcFilteredList.length) % fcFilteredList.length;
    renderActiveFlashcard();
  }

  function shuffleFlashcards() {
    if (fcFilteredList.length <= 1) return;
    for (let i = fcFilteredList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fcFilteredList[i], fcFilteredList[j]] = [fcFilteredList[j], fcFilteredList[i]];
    }
    fcCurrentIndex = 0;
    renderActiveFlashcard();
    showToast('Deck shuffled! 🔀', 'info');
  }

  function gradeFlashcard(isCorrect) {
    if (fcFilteredList.length === 0) return;
    const item = fcFilteredList[fcCurrentIndex];
    if (!item) return;

    const wasMastered = !!item.mastered;

    if (isCorrect) {
      item.streak = (item.streak || 0) + 1;
      if (item.streak >= masteryThreshold) {
        item.mastered = true;
        if (!wasMastered) {
          triggerConfetti();
        }
      }
    } else {
      item.streak = 0;
      item.mastered = false;
      item.wrongCount = (item.wrongCount || 0) + 1;
    }

    const orig = words.find((w) => w.id === item.id);
    if (orig) {
      orig.streak = item.streak;
      orig.mastered = item.mastered;
      orig.wrongCount = item.wrongCount;
    }

    saveWordsToStorage();
    renderEntries();

    if (fcFilteredList.length > 1) {
      fcCurrentIndex = (fcCurrentIndex + 1) % fcFilteredList.length;
    }
    renderActiveFlashcard();
  }

  /* ==========================================================================
     Pronunciation Engine (Optimized for Female Voice)
     ========================================================================== */

  function getBestFemaleVoice(voices, accent = 'US') {
    if (!voices || voices.length === 0) return null;

    const femaleKeywords = [
      'female', 'zira', 'jenny', 'aria', 'ava', 'sonia', 'libby', 'hazel',
      'samantha', 'victoria', 'karen', 'fiona', 'moira', 'serena', 'tessa',
      'stephanie', 'ana', 'michelle', 'claire', 'catherine', 'emma', 'olivia',
      'susan', 'allison', 'kate', 'veena', 'google us english', 'google uk english female'
    ];

    const langTarget = accent === 'UK' ? 'en-gb' : 'en-us';

    // 1. Target accent + explicitly female voice name
    let voice = voices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').replace('_', '-').toLowerCase();
      const matchLang = lang.startsWith(langTarget) || (accent === 'UK' ? name.includes('uk') || name.includes('british') : name.includes('us') || name.includes('united states'));
      return matchLang && femaleKeywords.some((kw) => name.includes(kw));
    });

    if (voice) return voice;

    // 2. Any English female voice
    voice = voices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('en') && femaleKeywords.some((kw) => name.includes(kw));
    });

    if (voice) return voice;

    // 3. Target accent standard voice
    voice = voices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').replace('_', '-').toLowerCase();
      return accent === 'UK' ? (lang.startsWith('en-gb') || name.includes('uk') || name.includes('british')) : (lang.startsWith('en-us') || name.includes('us') || name.includes('united states'));
    });

    if (voice) return voice;

    // 4. Any English voice fallback
    return voices.find((v) => (v.lang || '').toLowerCase().startsWith('en')) || voices[0] || null;
  }

  function pronounceWord(wordText, accent = 'US') {
    if (!('speechSynthesis' in window)) {
      showToast('Speech audio not supported in this browser.', 'error');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.rate = 0.92;
    utterance.pitch = 1.1; // Female tone pitch

    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = getBestFemaleVoice(voices, accent);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = accent === 'UK' ? 'en-GB' : 'en-US';
    }

    window.speechSynthesis.speak(utterance);
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  /* ==========================================================================
     Pure Generative AI Vocabulary Engine (Google Gemini 1.5/2.0 Flash)
     ========================================================================== */

  const VOCAB_CACHE_KEY = 'vocabvault_ai_cache_v3';
  let wordDetailsCache = {};
  try {
    const storedCache = localStorage.getItem(VOCAB_CACHE_KEY);
    if (storedCache) wordDetailsCache = JSON.parse(storedCache);
  } catch (e) {
    wordDetailsCache = {};
  }

  function getCachedWord(word) {
    if (!word) return null;
    const key = word.trim().toLowerCase();
    return wordDetailsCache[key] || null;
  }

  function setCachedWord(word, data) {
    if (!word || !data) return;
    const key = word.trim().toLowerCase();
    wordDetailsCache[key] = data;
    try {
      localStorage.setItem(VOCAB_CACHE_KEY, JSON.stringify(wordDetailsCache));
    } catch (e) {}
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  function cleanJsonText(rawText) {
    if (!rawText) return '';
    return rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  const GEMINI_MODEL_STORAGE = 'vocabvault_working_gemini_endpoint';
  // Clear any past invalid cached endpoint on script load
  localStorage.removeItem(GEMINI_MODEL_STORAGE);
  let workingGeminiEndpoint = '';

  function parseAiJsonResponse(rawText) {
    if (!rawText) return null;
    const cleaned = cleanJsonText(rawText);
    try {
      return JSON.parse(cleaned);
    } catch (e) {}

    // Extract first JSON object match
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {}
    }
    return null;
  }

  async function resolveGeminiEndpoint(apiKey) {
    if (workingGeminiEndpoint) return workingGeminiEndpoint;

    // 1. Query Google's ModelService ListModels API across both v1 and v1beta
    for (const apiVer of ['v1beta', 'v1']) {
      try {
        const listRes = await fetchWithTimeout(`https://generativelanguage.googleapis.com/${apiVer}/models?key=${encodeURIComponent(apiKey)}`, {
          method: 'GET'
        }, 3500);

        if (listRes.ok) {
          const listData = await listRes.json();
          const models = (listData.models || []).filter((m) => {
            const methods = m.supportedGenerationMethods || [];
            return methods.includes('generateContent') || methods.includes('generate_content');
          });

          if (models.length > 0) {
            const chosen = models.find((m) => m.name.includes('gemini-2.0-flash') && !m.name.includes('lite') && !m.name.includes('exp'))
                        || models.find((m) => m.name.includes('gemini-1.5-flash') && !m.name.includes('8b'))
                        || models.find((m) => m.name.includes('gemini-2.5'))
                        || models.find((m) => m.name.includes('gemini-2.0'))
                        || models.find((m) => m.name.includes('gemini-1.5'))
                        || models.find((m) => m.name.includes('flash'))
                        || models.find((m) => m.name.includes('pro'))
                        || models[0];

            if (chosen && chosen.name) {
              const cleanModelName = chosen.name.replace(/^models\//, '');
              const endpoint = `https://generativelanguage.googleapis.com/${apiVer}/models/${cleanModelName}:generateContent`;
              workingGeminiEndpoint = endpoint;
              localStorage.setItem(GEMINI_MODEL_STORAGE, endpoint);
              console.log(`VocabVault: Resolved working Gemini endpoint [${apiVer}] ->`, endpoint);
              return endpoint;
            }
          }
        }
      } catch (err) {
        console.warn(`VocabVault: ListModels query on ${apiVer} error:`, err);
      }
    }

    return null;
  }

  async function fetchWordDetailsAI(rawWord) {
    const word = (rawWord || '').trim();
    if (!word) return null;

    // 1. Instant Cache Check (< 1ms for previously AI-generated words)
    const cached = getCachedWord(word);
    if (cached) {
      return { ...cached, word };
    }

    const savedApiKey = (localStorage.getItem(GEMINI_KEY_STORAGE) || geminiApiKey || '').trim();

    // If no API key is configured, prompt the user immediately
    if (!savedApiKey) {
      showToast('🔑 Please paste your Google Gemini API Key in Settings (⚙️) to generate real AI definitions & sentences!', 'warning');
      openSettingsModal();
      if (geminiApiKeyInput) {
        setTimeout(() => geminiApiKeyInput.focus(), 250);
      }
      return null;
    }

    // 2. Pure Gemini Generative AI Request (1–2 seconds response time)
    const promptText = `You are an expert English vocabulary coach. Provide rich vocabulary information for the word or expression "${word}".
Return ONLY a valid JSON object matching this schema:
{
  "pos": "Noun" | "Verb" | "Adjective" | "Adverb" | "Idiom" | "Phrasal Verb",
  "meaning": "a crisp, natural, easy-to-understand definition in 6-12 words of plain everyday English (avoiding circular words or textbook jargon)",
  "sentence": "a vivid, natural, and realistic modern example sentence that clearly demonstrates its contextual meaning in everyday life",
  "synonyms": "3-4 simple, accurate comma-separated synonyms"
}`;

    const resolved = await resolveGeminiEndpoint(savedApiKey);

    const candidates = [
      resolved,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent'
    ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

    let lastErrMsg = '';

    for (const url of candidates) {
      try {
        const res = await fetchWithTimeout(`${url}?key=${encodeURIComponent(savedApiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 300
            }
          })
        }, 4500);

        if (res.ok) {
          const data = await res.json();
          const rawPart = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const parsed = parseAiJsonResponse(rawPart);

          if (parsed && parsed.meaning && parsed.sentence) {
            workingGeminiEndpoint = url;
            localStorage.setItem(GEMINI_MODEL_STORAGE, url);

            let cleanSentence = (parsed.sentence || '').trim();
            if (!/[.!?]$/.test(cleanSentence)) cleanSentence += '.';
            cleanSentence = cleanSentence.charAt(0).toUpperCase() + cleanSentence.slice(1);

            let cleanMeaning = (parsed.meaning || '').trim();
            if (!/[.!?]$/.test(cleanMeaning)) cleanMeaning += '.';
            cleanMeaning = cleanMeaning.charAt(0).toUpperCase() + cleanMeaning.slice(1);

            const result = {
              word: word,
              pos: parsed.pos || 'Noun',
              meaning: cleanMeaning,
              sentence: cleanSentence,
              notes: parsed.synonyms ? `Synonyms: ${parsed.synonyms}` : ''
            };

            setCachedWord(word, result);
            return result;
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          lastErrMsg = errorData.error?.message || `HTTP ${res.status}`;
          if (res.status === 404) {
            workingGeminiEndpoint = '';
            localStorage.removeItem(GEMINI_MODEL_STORAGE);
          }
          if (res.status === 400 || res.status === 403 || res.status === 401) {
            if (lastErrMsg.toLowerCase().includes('key') || lastErrMsg.toLowerCase().includes('credential') || lastErrMsg.toLowerCase().includes('api_key')) {
              showToast('⚠️ Invalid Gemini API Key. Please check your key in Settings (⚙️).', 'error');
              openSettingsModal();
              return null;
            }
          }
        }
      } catch (err) {
        lastErrMsg = err.message;
      }
    }

    if (lastErrMsg) {
      showToast(`⚠️ Gemini API Error: ${lastErrMsg}`, 'error');
    }

    return null;
  }

  /* ==========================================================================
     Add & Edit Word Modal with AI Integration
     ========================================================================== */

  async function autoFillModalWithAI(force = false) {
    if (!wordInput) return;
    const wordVal = (wordInput.value || '').trim();
    if (!wordVal) {
      if (force) showToast('Please type a word first!', 'info');
      return;
    }

    const currentEditId = editWordId ? editWordId.value : '';
    const duplicate = words.find((w) => w.id !== currentEditId && (w.word || '').trim().toLowerCase() === wordVal.toLowerCase());
    if (duplicate) {
      showToast(`⚠️ "${duplicate.word}" is already in your vault!`, 'warning');
      return;
    }

    if (!force && meaningInput && meaningInput.value.trim() && sentenceInput && sentenceInput.value.trim()) {
      return;
    }

    if (aiInlineSpinner) aiInlineSpinner.style.display = 'inline-block';
    if (triggerAiAutoFillBtn) triggerAiAutoFillBtn.disabled = true;

    try {
      const details = await fetchWordDetailsAI(wordVal);
      if (details) {
        if (posSelect && details.pos) posSelect.value = details.pos;
        if (meaningInput && details.meaning) meaningInput.value = details.meaning;
        if (sentenceInput && details.sentence) sentenceInput.value = details.sentence;
        if (notesInput && details.notes) notesInput.value = details.notes;
        
        showToast(`✨ Auto-filled details for "${wordVal}"`, 'success');
      }
    } catch (err) {
      console.error('AI auto-fill failed:', err);
      showToast('Could not auto-fill word details.', 'error');
    } finally {
      if (aiInlineSpinner) aiInlineSpinner.style.display = 'none';
      if (triggerAiAutoFillBtn) triggerAiAutoFillBtn.disabled = false;
    }
  }

  async function handleAiQuickAdd(e) {
    e.preventDefault();
    if (!aiQuickWordInput) return;
    const wordVal = (aiQuickWordInput.value || '').trim();
    if (!wordVal) return;

    // Strict Duplicate Check (Case-insensitive)
    const existing = words.find((w) => (w.word || '').trim().toLowerCase() === wordVal.toLowerCase());
    if (existing) {
      showToast(`⚠️ "${existing.word}" is already in your vault (${existing.date})!`, 'warning');
      revealedCardIds.add(existing.id);
      renderEntries();
      const cardEl = document.getElementById(`card-${existing.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardEl.style.boxShadow = '0 0 0 3px var(--accent-amber)';
        setTimeout(() => {
          if (cardEl) cardEl.style.boxShadow = '';
        }, 2500);
      }
      return;
    }

    const btnText = aiQuickAddBtn ? aiQuickAddBtn.querySelector('.ai-btn-text') : null;
    const btnSpinner = aiQuickAddBtn ? aiQuickAddBtn.querySelector('.ai-btn-spinner') : null;

    if (btnText) btnText.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'inline-flex';
    if (aiQuickAddBtn) aiQuickAddBtn.disabled = true;

    try {
      const details = await fetchWordDetailsAI(wordVal);
      if (details) {
        // Double check duplicate before inserting
        const doubleCheck = words.find((w) => (w.word || '').trim().toLowerCase() === (details.word || wordVal).trim().toLowerCase());
        if (doubleCheck) {
          showToast(`⚠️ "${doubleCheck.word}" is already in your vault!`, 'warning');
          return;
        }

        const newWord = {
          id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          word: details.word || wordVal,
          pos: details.pos || 'Noun',
          date: getTodayISO(),
          meaning: details.meaning,
          sentence: details.sentence,
          notes: details.notes || '',
          streak: 0,
          mastered: false,
          createdAt: Date.now()
        };

        words.unshift(newWord);
        revealedCardIds.add(newWord.id);
        saveWordsToStorage();
        renderCalendar();
        renderEntries();

        aiQuickWordInput.value = '';
        showToast(`✨ Added "${newWord.word}" to your vault with AI!`, 'success');
      }
    } catch (err) {
      console.error('Quick AI add failed:', err);
      showToast('Error adding word with AI.', 'error');
    } finally {
      if (btnText) btnText.style.display = 'inline';
      if (btnSpinner) btnSpinner.style.display = 'none';
      if (aiQuickAddBtn) aiQuickAddBtn.disabled = false;
    }
  }

  function openAddModal() {
    if (!wordModalBackdrop) return;
    if (modalTitle) modalTitle.textContent = 'Add New Word';
    if (editWordId) editWordId.value = '';
    if (wordForm) wordForm.reset();
    if (dateInput) dateInput.value = dateFilterState.startDate || getTodayISO();
    if (statusSelect) statusSelect.value = 'learning';
    wordModalBackdrop.classList.add('open');
    wordModalBackdrop.setAttribute('aria-hidden', 'false');
    if (wordInput) setTimeout(() => wordInput.focus(), 100);
  }

  function openEditModal(id) {
    const item = words.find((w) => w.id === id);
    if (!item || !wordModalBackdrop) return;

    if (modalTitle) modalTitle.textContent = 'Edit Word';
    if (editWordId) editWordId.value = item.id;
    if (wordInput) wordInput.value = item.word;
    if (posSelect) posSelect.value = item.pos || 'Noun';
    if (dateInput) dateInput.value = item.date || getTodayISO();
    if (statusSelect) statusSelect.value = item.mastered ? 'mastered' : 'learning';
    if (meaningInput) meaningInput.value = item.meaning || '';
    if (sentenceInput) sentenceInput.value = item.sentence || '';
    if (notesInput) notesInput.value = item.notes || '';

    wordModalBackdrop.classList.add('open');
    wordModalBackdrop.setAttribute('aria-hidden', 'false');
    if (wordInput) setTimeout(() => wordInput.focus(), 100);
  }

  function closeModal() {
    if (wordModalBackdrop) {
      wordModalBackdrop.classList.remove('open');
      wordModalBackdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function handleWordFormSubmit(e) {
    e.preventDefault();
    if (!wordInput || !meaningInput || !sentenceInput || !dateInput) return;

    const id = editWordId ? editWordId.value : '';
    const wordVal = wordInput.value.trim();
    const posVal = posSelect ? posSelect.value : 'Noun';
    const dateVal = dateInput.value;
    const isMastered = statusSelect ? statusSelect.value === 'mastered' : false;
    const meaningVal = meaningInput.value.trim();
    const sentenceVal = sentenceInput.value.trim();
    const notesVal = notesInput ? notesInput.value.trim() : '';

    if (!wordVal || !meaningVal || !sentenceVal || !dateVal) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    // Strict Duplicate Check (Case-insensitive)
    const duplicate = words.find((w) => w.id !== id && (w.word || '').trim().toLowerCase() === wordVal.toLowerCase());
    if (duplicate) {
      showToast(`⚠️ "${duplicate.word}" is already in your vault (${duplicate.date})!`, 'warning');
      if (wordInput) wordInput.focus();
      return;
    }

    if (id) {
      const index = words.findIndex((w) => w.id === id);
      if (index !== -1) {
        words[index] = {
          ...words[index],
          word: wordVal,
          pos: posVal,
          date: dateVal,
          mastered: isMastered,
          streak: isMastered ? masteryThreshold : 0,
          meaning: meaningVal,
          sentence: sentenceVal,
          notes: notesVal
        };
        showToast(`Updated "${wordVal}"`, 'success');
      }
    } else {
      const newWord = {
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        word: wordVal,
        pos: posVal,
        date: dateVal,
        meaning: meaningVal,
        sentence: sentenceVal,
        notes: notesVal,
        streak: isMastered ? masteryThreshold : 0,
        mastered: isMastered,
        createdAt: Date.now()
      };
      words.unshift(newWord);
      showToast(`Added "${wordVal}" to your vault!`, 'success');
    }

    saveWordsToStorage();
    renderCalendar();
    renderEntries();
    closeModal();
  }

  /* ==========================================================================
     Custom Confirmation Dialog Helper
     ========================================================================== */

  function showConfirmModal({ title, message, actionText = 'Confirm', type = 'danger', onConfirm }) {
    if (!confirmModalBackdrop) {
      if (typeof onConfirm === 'function') onConfirm();
      return;
    }

    if (confirmModalTitle) confirmModalTitle.textContent = title || 'Are you sure?';
    if (confirmModalDesc) confirmModalDesc.textContent = message || '';
    if (confirmModalActionBtn) {
      confirmModalActionBtn.textContent = actionText;
      confirmModalActionBtn.className = `btn btn-${type}`;
    }

    if (confirmModalIcon) {
      confirmModalIcon.className = `confirm-icon-wrap type-${type}`;
      if (type === 'danger') {
        confirmModalIcon.innerHTML = `
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        `;
      } else if (type === 'warning') {
        confirmModalIcon.innerHTML = `
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        `;
      } else {
        confirmModalIcon.innerHTML = `
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        `;
      }
    }

    activeConfirmCallback = onConfirm;
    confirmModalBackdrop.classList.add('open');
    confirmModalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeConfirmModal() {
    if (confirmModalBackdrop) {
      confirmModalBackdrop.classList.remove('open');
      confirmModalBackdrop.setAttribute('aria-hidden', 'true');
    }
    activeConfirmCallback = null;
  }

  function deleteWord(id) {
    const item = words.find((w) => w.id === id);
    if (!item) return;

    showConfirmModal({
      title: 'Delete Word?',
      message: `Are you sure you want to delete "${item.word}" from your vault? This cannot be undone.`,
      actionText: 'Delete Word',
      type: 'danger',
      onConfirm: () => {
        words = words.filter((w) => w.id !== id);
        revealedCardIds.delete(id);
        saveWordsToStorage();
        renderCalendar();
        renderEntries();
        showToast(`Deleted "${item.word}"`, 'info');
      }
    });
  }

  /* ==========================================================================
     Backup, Restore & Settings
     ========================================================================== */

  function openSettingsModal() {
    if (settingsModalBackdrop) {
      settingsModalBackdrop.classList.add('open');
      settingsModalBackdrop.setAttribute('aria-hidden', 'false');
    }
  }

  function closeSettingsModal() {
    if (settingsModalBackdrop) {
      settingsModalBackdrop.classList.remove('open');
      settingsModalBackdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function exportData() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(words, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vocabvault_backup_${getTodayISO()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Vocabulary exported successfully!', 'success');
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          const existingIds = new Set(words.map((w) => w.id));
          const existingWords = new Set(words.map((w) => (w.word || '').trim().toLowerCase()));
          let addedCount = 0;
          let skippedCount = 0;

          imported.forEach((item) => {
            if (item.word && item.meaning) {
              const wordLower = (item.word || '').trim().toLowerCase();
              if (existingWords.has(wordLower)) {
                skippedCount++;
                return;
              }
              existingWords.add(wordLower);

              if (!item.id || existingIds.has(item.id)) {
                item.id = 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
              }
              existingIds.add(item.id);
              words.push(item);
              addedCount++;
            }
          });

          saveWordsToStorage();
          renderCalendar();
          renderEntries();
          closeSettingsModal();
          if (skippedCount > 0) {
            showToast(`Imported ${addedCount} new words (${skippedCount} duplicates skipped).`, 'success');
          } else {
            showToast(`Successfully imported ${addedCount} words!`, 'success');
          }
        } else {
          showToast('Invalid JSON structure.', 'error');
        }
      } catch (err) {
        showToast('Error reading JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function loadSampleData() {
    showConfirmModal({
      title: 'Load Starter Vocabulary?',
      message: 'This will load curated sample English vocabulary words into your vault.',
      actionText: 'Load Words',
      type: 'info',
      onConfirm: () => {
        words = [...DEFAULT_SAMPLE_WORDS];
        saveWordsToStorage();
        renderCalendar();
        renderEntries();
        closeSettingsModal();
        showToast('Starter vocabulary loaded!', 'success');
      }
    });
  }

  function clearAllData() {
    showConfirmModal({
      title: 'Clear All Words?',
      message: 'Are you sure you want to delete ALL vocabulary words from your vault? This action cannot be reversed.',
      actionText: 'Delete Everything',
      type: 'danger',
      onConfirm: () => {
        words = [];
        revealedCardIds.clear();
        saveWordsToStorage();
        renderCalendar();
        renderEntries();
        closeSettingsModal();
        showToast('All words cleared from vault.', 'info');
      }
    });
  }

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ==========================================================================
     Event Listeners Setup & Keyboard Shortcuts
     ========================================================================== */

  function setupEventListeners() {
    // Calendar Navigation & Preset Range Buttons
    if (calPrevMonthBtn) {
      calPrevMonthBtn.addEventListener('click', () => {
        calViewMonth--;
        if (calViewMonth < 0) {
          calViewMonth = 11;
          calViewYear--;
        }
        renderCalendar();
      });
    }

    if (calNextMonthBtn) {
      calNextMonthBtn.addEventListener('click', () => {
        calViewMonth++;
        if (calViewMonth > 11) {
          calViewMonth = 0;
          calViewYear++;
        }
        renderCalendar();
      });
    }

    if (calFilterAllBtn) calFilterAllBtn.addEventListener('click', () => setDateFilter('all', null, null, 'All Dates'));
    if (calFilterTodayBtn) calFilterTodayBtn.addEventListener('click', () => setDateFilter('single', getTodayISO(), getTodayISO(), 'Today'));
    if (calFilterLast7Btn) calFilterLast7Btn.addEventListener('click', () => setDateFilter('range', getRelativeDateISO(7), getTodayISO(), 'Last 7 Days'));
    if (calFilterLast30Btn) calFilterLast30Btn.addEventListener('click', () => setDateFilter('range', getRelativeDateISO(30), getTodayISO(), 'Last 30 Days'));
    
    if (calFilterThisMonthBtn) {
      calFilterThisMonthBtn.addEventListener('click', () => {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const start = `${y}-${m}-01`;
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        setDateFilter('range', start, end, `This Month (${MONTH_NAMES[now.getMonth()]})`);
      });
    }

    if (toggleRangePickerBtn) {
      toggleRangePickerBtn.addEventListener('click', () => {
        if (!rangeInputsContainer) return;
        const isHidden = rangeInputsContainer.style.display === 'none';
        rangeInputsContainer.style.display = isHidden ? 'block' : 'none';
        if (toggleRangePickerBtn.parentElement) {
          toggleRangePickerBtn.parentElement.classList.toggle('expanded', isHidden);
        }
        if (isHidden && rangeStartDate && rangeEndDate && !rangeStartDate.value) {
          rangeStartDate.value = getRelativeDateISO(7);
          rangeEndDate.value = getTodayISO();
        }
      });
    }

    if (applyRangeBtn) {
      applyRangeBtn.addEventListener('click', () => {
        if (!rangeStartDate || !rangeEndDate) return;
        const s = rangeStartDate.value;
        const e = rangeEndDate.value;
        if (!s || !e) {
          showToast('Please select both Start Date and To Date.', 'error');
          return;
        }
        if (s > e) {
          showToast('Start date cannot be after End date.', 'error');
          return;
        }
        setDateFilter('range', s, e, `Range: ${s} to ${e}`);
        showToast(`Filtered by range: ${s} → ${e}`, 'info');
      });
    }

    if (clearRangeBtn) {
      clearRangeBtn.addEventListener('click', () => {
        if (rangeStartDate) rangeStartDate.value = '';
        if (rangeEndDate) rangeEndDate.value = '';
        setDateFilter('all', null, null, 'All Dates');
      });
    }

    if (clearCalendarFilterBtn) {
      clearCalendarFilterBtn.addEventListener('click', () => setDateFilter('all', null, null, 'All Dates'));
    }

    // Feed event delegation (Click anywhere on meaning box toggles hide/unhide)
    if (feedSection) {
      feedSection.addEventListener('click', (e) => {
        // 1. Check if user clicked an action button (speak, edit, delete, grade, status toggle, day reveal)
        const btn = e.target.closest('button, [data-action="toggle-day"]');
        if (btn) {
          const action = btn.dataset.action;
          const id = btn.dataset.id;
          const wordText = btn.dataset.word;
          const dateVal = btn.dataset.date;

          if (action === 'speak' && wordText) {
            pronounceWord(wordText, 'US');
            return;
          } else if (action === 'grade-right-inline' && id) {
            applyWordGrading(id, true);
            return;
          } else if (action === 'grade-wrong-inline' && id) {
            applyWordGrading(id, false);
            return;
          } else if (action === 'edit' && id) {
            openEditModal(id);
            return;
          } else if (action === 'delete' && id) {
            deleteWord(id);
            return;
          } else if (action === 'toggle-day' && dateVal) {
            toggleDayDetails(dateVal);
            return;
          }
        }

        // 2. Check if user clicked ANYWHERE inside the meaning / details container
        const detailsContainer = e.target.closest('.hidden-details-container');
        if (detailsContainer) {
          // If user selected text with mouse, do not toggle
          const isTextSelected = window.getSelection() && window.getSelection().toString().trim().length > 0;
          if (isTextSelected) return;

          const wordId = detailsContainer.dataset.id || (detailsContainer.id ? detailsContainer.id.replace('details-', '') : null);
          if (wordId) {
            const isCurrentlyUnhidden = detailsContainer.classList.contains('unhidden') || revealedCardIds.has(wordId);
            if (isCurrentlyUnhidden) {
              revealedCardIds.delete(wordId);
              detailsContainer.classList.remove('unhidden');
              detailsContainer.title = 'Click anywhere to reveal';
            } else {
              revealedCardIds.add(wordId);
              detailsContainer.classList.add('unhidden');
              detailsContainer.title = 'Click anywhere to hide';
            }
          }
        }
      });
    }

    // Search
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (clearSearchBtn) clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        renderEntries();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderEntries();
        if (searchInput) searchInput.focus();
      });
    }

    // Status filter pills
    if (filterPills && filterPills.length > 0) {
      filterPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          filterPills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          statusFilter = pill.dataset.filter;
          renderEntries();
        });
      });
    }

    if (toggleAllRevealBtn) toggleAllRevealBtn.addEventListener('click', toggleAllDetails);
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', openAddModal);

    // Flashcard Modal
    if (openFlashcardModalBtn) openFlashcardModalBtn.addEventListener('click', openFlashcardModal);
    if (closeFlashcardModalBtn) closeFlashcardModalBtn.addEventListener('click', closeFlashcardModal);
    if (flashcardModalBackdrop) {
      flashcardModalBackdrop.addEventListener('click', (e) => {
        if (e.target === flashcardModalBackdrop) closeFlashcardModal();
      });
    }

    if (mainDeckCard) mainDeckCard.addEventListener('click', flipFlashcard);

    if (fcSpeakUsBtn) {
      fcSpeakUsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fcFilteredList.length > 0 && fcFilteredList[fcCurrentIndex]) {
          pronounceWord(fcFilteredList[fcCurrentIndex].word, 'US');
        }
      });
    }

    if (fcSpeakUkBtn) {
      fcSpeakUkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fcFilteredList.length > 0 && fcFilteredList[fcCurrentIndex]) {
          pronounceWord(fcFilteredList[fcCurrentIndex].word, 'UK');
        }
      });
    }

    if (fcNextBtn) fcNextBtn.addEventListener('click', nextFlashcard);
    if (fcPrevBtn) fcPrevBtn.addEventListener('click', prevFlashcard);
    if (fcShuffleBtn) fcShuffleBtn.addEventListener('click', shuffleFlashcards);

    if (fcPracticeModeSelect) {
      fcPracticeModeSelect.addEventListener('change', (e) => {
        practiceMode = e.target.value;
        renderActiveFlashcard();
      });
    }

    if (fcPracticeDateSelect) {
      fcPracticeDateSelect.addEventListener('change', () => {
        const isCustom = fcPracticeDateSelect.value === 'custom';
        if (fcCustomRangeWrap) fcCustomRangeWrap.style.display = isCustom ? 'flex' : 'none';
        if (isCustom && fcCustomStart && fcCustomEnd && !fcCustomStart.value) {
          fcCustomStart.value = getRelativeDateISO(7);
          fcCustomEnd.value = getTodayISO();
        }
        refreshFlashcards(true);
      });
    }

    if (fcPracticeStatusSelect) fcPracticeStatusSelect.addEventListener('change', () => refreshFlashcards(true));
    if (fcApplyCustomRangeBtn) fcApplyCustomRangeBtn.addEventListener('click', () => refreshFlashcards(true));
    if (fcGradeWrongBtn) fcGradeWrongBtn.addEventListener('click', () => gradeFlashcard(false));
    if (fcGradeRightBtn) fcGradeRightBtn.addEventListener('click', () => gradeFlashcard(true));

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (wordModalBackdrop && wordModalBackdrop.classList.contains('open')) return;
      if (settingsModalBackdrop && settingsModalBackdrop.classList.contains('open')) return;

      if (flashcardModalBackdrop && flashcardModalBackdrop.classList.contains('open')) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          flipFlashcard();
        } else if (e.key === '1' || e.key.toLowerCase() === 'x') {
          e.preventDefault();
          gradeFlashcard(false);
        } else if (e.key === '2' || e.key.toLowerCase() === 'c') {
          e.preventDefault();
          gradeFlashcard(true);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextFlashcard();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevFlashcard();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (fcFilteredList.length > 0 && fcFilteredList[fcCurrentIndex]) {
            pronounceWord(fcFilteredList[fcCurrentIndex].word, 'US');
          }
        }
      }
    });

    // AI Auto-Add & Modal Auto-Fill Event Listeners
    if (aiQuickAddForm) {
      aiQuickAddForm.addEventListener('submit', handleAiQuickAdd);
    }

    if (triggerAiAutoFillBtn) {
      triggerAiAutoFillBtn.addEventListener('click', () => autoFillModalWithAI(true));
    }

    if (wordInput) {
      wordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && meaningInput && !meaningInput.value.trim()) {
          e.preventDefault();
          autoFillModalWithAI(true);
        }
      });
      wordInput.addEventListener('blur', () => autoFillModalWithAI(false));
    }

    if (geminiApiKeyInput) {
      geminiApiKeyInput.addEventListener('input', (e) => {
        geminiApiKey = e.target.value.trim();
        localStorage.setItem(GEMINI_KEY_STORAGE, geminiApiKey);
        workingGeminiEndpoint = '';
        localStorage.removeItem(GEMINI_MODEL_STORAGE);
      });
    }

    // Word Modal
    if (addWordBtn) addWordBtn.addEventListener('click', openAddModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
    if (wordForm) wordForm.addEventListener('submit', handleWordFormSubmit);
    if (wordModalBackdrop) {
      wordModalBackdrop.addEventListener('click', (e) => {
        if (e.target === wordModalBackdrop) closeModal();
      });
    }

    // Settings & Theme
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsModal);
    if (saveSettingsDoneBtn) {
      saveSettingsDoneBtn.addEventListener('click', () => {
        if (geminiApiKeyInput) {
          geminiApiKey = geminiApiKeyInput.value.trim();
          localStorage.setItem(GEMINI_KEY_STORAGE, geminiApiKey);
          workingGeminiEndpoint = '';
          localStorage.removeItem(GEMINI_MODEL_STORAGE);
          if (geminiApiKey) {
            resolveGeminiEndpoint(geminiApiKey).catch(() => {});
          }
        }
        closeSettingsModal();
        showToast('Settings saved successfully!', 'success');
      });
    }
    if (settingsModalBackdrop) {
      settingsModalBackdrop.addEventListener('click', (e) => {
        if (e.target === settingsModalBackdrop) closeSettingsModal();
      });
    }

    if (masteryThresholdSelect) {
      masteryThresholdSelect.addEventListener('change', (e) => {
        masteryThreshold = parseInt(e.target.value, 10) || 5;
        localStorage.setItem(THRESHOLD_KEY, masteryThreshold.toString());
        if (thresholdDisplayNum) thresholdDisplayNum.textContent = `${masteryThreshold} times`;
        renderEntries();
        renderActiveFlashcard();
        showToast(`Mastery goal updated to ${masteryThreshold} times ✓`, 'info');
      });
    }

    if (exportDataBtn) exportDataBtn.addEventListener('click', exportData);
    if (importDataBtn && importFileInput) importDataBtn.addEventListener('click', () => importFileInput.click());
    if (importFileInput) importFileInput.addEventListener('change', handleImportFile);
    if (loadSampleDataBtn) loadSampleDataBtn.addEventListener('click', loadSampleData);
    if (clearAllDataBtn) clearAllDataBtn.addEventListener('click', clearAllData);

    // Confirmation Modal Event Listeners
    if (confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', closeConfirmModal);
    if (confirmModalActionBtn) {
      confirmModalActionBtn.addEventListener('click', () => {
        if (typeof activeConfirmCallback === 'function') {
          activeConfirmCallback();
        }
        closeConfirmModal();
      });
    }
    if (confirmModalBackdrop) {
      confirmModalBackdrop.addEventListener('click', (e) => {
        if (e.target === confirmModalBackdrop) closeConfirmModal();
      });
    }
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  function init() {
    initTheme();
    loadThresholdFromStorage();
    geminiApiKey = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    if (geminiApiKeyInput) geminiApiKeyInput.value = geminiApiKey;
    loadWordsFromStorage();
    setupEventListeners();
    renderCalendar();
    renderEntries();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
