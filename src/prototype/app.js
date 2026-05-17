/* ─── Brain Sync prototype: routing + shared state ─── */
(function () {
  // Shared booking state — passed between screens
  const state = {
    course: '',
    year: 'Year 2',
    semester: 'Fall 2026',
    needs: ['Exam prep'],
    tutor: null,            // set when a tutor card is clicked
    slot: null,             // { day, date, time } when picked in calendar
    format: 'online',       // 'online' | 'in-person'
    duration: 60,           // minutes
    topic: '',
    rate: 22                // for become-a-tutor slider
  };

  const screens = ['home', 'browse', 'tutor', 'slot', 'details', 'checkout', 'confirmed', 'sessions', 'apply', 'apply-sent'];

  // ─── Hash routing ───
  function show(name) {
    if (!screens.includes(name)) name = 'home';
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.toggle('is-active', s.dataset.screen === name);
    });
    document.querySelectorAll('.nav a[data-go]').forEach(a => {
      a.classList.toggle('is-active', a.dataset.go === name);
    });
    if (location.hash !== '#' + name) location.hash = name;
    window.scrollTo({ top: 0, behavior: 'instant' });
    onShow(name);
  }
  window.show = show;
  window.state = state;

  function go(name) { show(name); }

  // Per-screen mount hooks
  function onShow(name) {
    if (name === 'browse') { applyBrowseFilter(); }
    if (name === 'tutor') renderTutorProfile();
    if (name === 'slot') renderSlotSummary();
    if (name === 'details') renderDetailsSummary();
    if (name === 'checkout') renderCheckoutSummary();
    if (name === 'confirmed') renderConfirmation();
    if (name === 'sessions') renderSessions();
    if (name === 'apply') renderApplyPreview();
    if (name === 'apply-sent') renderApplySent();
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    const initial = (location.hash || '#home').slice(1);
    show(initial);

    // Wire up [data-go] anywhere
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-go]');
      if (!target) return;
      e.preventDefault();
      go(target.dataset.go);
    });

    initHomeTabs();
    initHomeChips();
    initRateSlider();
    initFilters();
    initTutorTabs();
    initCalendar();
    initFormatPicker();
    initPayTabs();
    initCourseSearch();
    initApply();
  });

  window.addEventListener('hashchange', () => {
    const name = (location.hash || '#home').slice(1);
    show(name);
  });

  // ─── Home tabs (kept for backwards-compat; no-op if removed) ───
  function initHomeTabs() {
    document.querySelectorAll('.home-hero .tab').forEach(t => {
      t.addEventListener('click', () => {
        const name = t.dataset.tab;
        document.querySelectorAll('.home-hero .tab').forEach(x => x.classList.toggle('is-active', x === t));
        document.querySelectorAll('.home-hero .panel').forEach(p =>
          p.classList.toggle('is-active', p.dataset.panel === name));
      });
    });
  }

  function initHomeChips() {
    document.querySelectorAll('#home-needs .chip').forEach(c => {
      c.addEventListener('click', () => {
        c.classList.toggle('is-on');
        const on = [...document.querySelectorAll('#home-needs .chip.is-on')].map(x => x.textContent.trim());
        state.needs = on;
      });
    });
    const courseInput = document.getElementById('home-course');
    if (courseInput) {
      courseInput.addEventListener('input', () => { state.course = courseInput.value || state.course; });
    }
  }

  // ─── Course search & filter ───
  function initCourseSearch() {
    // Autocomplete on every course-search input
    const home = document.getElementById('home-course');
    if (home) attachAutocomplete(home, {
      dark: true,
      onPick: (c) => { state.course = c.name; }
    });

    const browse = document.getElementById('browse-search');
    if (browse) attachAutocomplete(browse, {
      onPick: (c) => { state.course = c.name; applyBrowseFilter(); }
    });

    const details = document.getElementById('details-course');
    if (details) attachAutocomplete(details);

    // Home "See matching tutors" → take the typed course over to browse
    document.querySelectorAll('[data-go="browse"]').forEach(b => {
      b.addEventListener('click', () => {
        if (home && home.value.trim()) state.course = home.value.trim();
      }, { capture: true });
    });

    // Browse search: filter as user types
    if (browse) {
      browse.addEventListener('input', () => {
        state.course = browse.value.trim() || state.course;
        applyBrowseFilter();
      });
    }

    // Filter checkboxes (format, language) re-apply too
    document.querySelectorAll('.filters input').forEach(cb => {
      cb.addEventListener('change', applyBrowseFilter);
    });
  }

  function applyBrowseFilter() {
    const q = (state.course || '').toLowerCase().trim();
    const langs = [...document.querySelectorAll('.filters .lang-opt input:checked')].map(i => i.value);

    if (!q) {
      // No search query → hide all cards, show empty prompt
      document.querySelectorAll('.tutor-card').forEach(card => {
        card.hidden = true;
        card.classList.remove('is-expanded');
      });
    } else {
      document.querySelectorAll('.tutor-card').forEach(card => {
        // Parse "course1, course2, course3" into an array of trimmed course names
        const courseList = (card.dataset.courses || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        const cLangs = (card.dataset.langs || '').split(',');

        // STRICT MATCH: at least one of the tutor's courses must EXACTLY equal the query.
        // Falls back to substring only when the query is clearly a partial type-ahead
        // (i.e. doesn't appear in the IMC course catalog).
        const isKnownCourse = (window.COURSES || [])
          .some(c => c.name.toLowerCase() === q);
        const matches = isKnownCourse
          ? courseList.includes(q)
          : courseList.some(c => c.includes(q));

        let show = matches;
        if (show && langs.length && !langs.some(l => cLangs.includes(l))) show = false;

        card.hidden = !show;
        card.classList.toggle('is-expanded', show);
      });
    }

    // Update title with the searched course
    const title = document.getElementById('browse-title');
    if (title) title.innerHTML = q
      ? 'Tutors for <em>' + escapeHtml(state.course) + '</em>'
      : 'Find a <em>tutor</em>';

    const sub = document.getElementById('browse-sub');
    if (sub) sub.textContent = q
      ? 'Verified IMC Krems students who took this course in the last 2 semesters.'
      : 'Search the IMC Krems course catalog to see tutors who took the course last semester.';

    // Sync the browse search input value
    const browse = document.getElementById('browse-search');
    if (browse && browse.value !== state.course) browse.value = state.course || '';
    renderResultsCount();
  }
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  function initRateSlider() {
    const slider = document.getElementById('rateSlider');
    if (!slider) return;
    const value = document.getElementById('rateValue');
    const net = document.getElementById('rateNet');
    function update() {
      const v = Number(slider.value);
      const min = Number(slider.min), max = Number(slider.max);
      slider.style.setProperty('--fill', (((v - min) / (max - min)) * 100) + '%');
      value.textContent = v;
      net.textContent = '€' + (v * 0.85).toFixed(2);
      state.rate = v;
    }
    slider.addEventListener('input', update);
    update();
  }

  // ─── IMC Krems course catalog ───
  const COURSES = [
    // Health & Life Sciences
    { name: 'Organic Chemistry',         program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Biochemistry',              program: 'Medical & Pharmaceutical Biotech' },
    { name: 'General Biology',           program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Anatomy I',                 program: 'Health Management' },
    { name: 'Anatomy II',                program: 'Health Management' },
    { name: 'Physiology',                program: 'Health Management' },
    { name: 'Pathology',                 program: 'Health Management' },
    { name: 'Pharmacology',              program: 'Health Management' },
    { name: 'Healthcare Management',     program: 'Health Management' },
    { name: 'Health Economics',          program: 'Health Management' },
    { name: 'Cell Biology',              program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Molecular Biology',         program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Genetics',                  program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Microbiology',              program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Immunology',                program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Clinical Trial Management', program: 'Medical & Pharmaceutical Biotech' },
    { name: 'Medical Device Regulation', program: 'Medical & Pharmaceutical Biotech' },

    // Business
    { name: 'Microeconomics',            program: 'International Business' },
    { name: 'Macroeconomics',            program: 'International Business' },
    { name: 'Financial Accounting',      program: 'International Business' },
    { name: 'Managerial Accounting',     program: 'International Business' },
    { name: 'Corporate Finance',         program: 'International Business' },
    { name: 'Business Law',              program: 'International Business' },
    { name: 'International Business',    program: 'International Business' },
    { name: 'Strategic Management',      program: 'International Business' },
    { name: 'Operations Management',     program: 'International Business' },
    { name: 'Human Resource Management', program: 'International Business' },
    { name: 'Organizational Behavior',   program: 'International Business' },

    // Marketing
    { name: 'Marketing Fundamentals',    program: 'Marketing' },
    { name: 'Marketing Research',        program: 'Marketing' },
    { name: 'Consumer Behavior',         program: 'Marketing' },
    { name: 'Digital Marketing',         program: 'Marketing' },
    { name: 'Brand Management',          program: 'Marketing' },

    // Digital Business / CS
    { name: 'Programming Fundamentals',  program: 'Informatics' },
    { name: 'Programming in Python',     program: 'Informatics' },
    { name: 'Programming in Java',       program: 'Informatics' },
    { name: 'Object-Oriented Programming', program: 'Informatics' },
    { name: 'Algorithms',                program: 'Informatics' },
    { name: 'Algorithm Design',          program: 'Informatics' },
    { name: 'Data Structures',           program: 'Informatics' },
    { name: 'Discrete Mathematics',      program: 'Informatics' },
    { name: 'Software Engineering',      program: 'Informatics' },
    { name: 'Database Systems',          program: 'Informatics' },
    { name: 'Web Development',           program: 'Informatics' },
    { name: 'Machine Learning',          program: 'Informatics' },
    { name: 'Data Analytics',            program: 'Informatics' },
    { name: 'Project Management (IT)',   program: 'Informatics' },

    // Mathematics
    { name: 'Mathematics',               program: 'Cross-program' },
    { name: 'Calculus I',                program: 'Cross-program' },
    { name: 'Calculus II',               program: 'Cross-program' },
    { name: 'Linear Algebra',            program: 'Cross-program' },
    { name: 'Probability Theory',        program: 'Cross-program' },

    // Tourism
    { name: 'Tourism Management',        program: 'Tourism & Leisure' },
    { name: 'Hospitality Management',    program: 'Tourism & Leisure' },
    { name: 'Destination Marketing',     program: 'Tourism & Leisure' },
    { name: 'Event Management',          program: 'Tourism & Leisure' },

    // Cross-program
    { name: 'Statistics I',              program: 'Cross-program' },
    { name: 'Statistics II',             program: 'Cross-program' },
    { name: 'Research Methods',          program: 'Cross-program' },
    { name: 'Academic Writing',          program: 'Cross-program' },
    { name: 'Business English',          program: 'Cross-program' },
    { name: 'German B2',                 program: 'Cross-program' },
    { name: 'Spanish A1',                program: 'Cross-program' }
  ];
  window.COURSES = COURSES;

  // ─── Reusable autocomplete ───
  function attachAutocomplete(input, opts) {
    if (!input || input.dataset.acOn) return;
    input.dataset.acOn = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    // Wrap input in positioned container so the menu can be absolutely positioned
    const wrap = document.createElement('div');
    wrap.className = 'ac-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const menu = document.createElement('div');
    menu.className = 'ac-menu' + (opts && opts.dark ? ' ac-menu-dark' : '');
    menu.hidden = true;
    wrap.appendChild(menu);

    let active = -1;
    let items = [];

    function filter(q) {
      const ql = q.trim().toLowerCase();
      if (!ql) return COURSES.slice(0, 8);
      const starts = [], contains = [];
      for (const c of COURSES) {
        const n = c.name.toLowerCase();
        if (n.startsWith(ql)) starts.push(c);
        else if (n.includes(ql) || c.program.toLowerCase().includes(ql)) contains.push(c);
      }
      return starts.concat(contains).slice(0, 8);
    }

    function render() {
      items = filter(input.value);
      if (!items.length) { menu.hidden = true; return; }
      menu.innerHTML = items.map((c, i) =>
        `<button type="button" class="ac-item${i === active ? ' is-on' : ''}" data-i="${i}">
          <span class="ac-name">${c.name}</span>
          <span class="ac-prog">${c.program}</span>
        </button>`
      ).join('');
      menu.hidden = false;
    }
    function close() { menu.hidden = true; active = -1; }
    function pick(i) {
      if (i < 0 || i >= items.length) return;
      input.value = items[i].name;
      close();
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (opts && opts.onPick) opts.onPick(items[i]);
    }

    input.addEventListener('focus', render);
    input.addEventListener('input', () => { active = -1; render(); });
    input.addEventListener('blur', () => setTimeout(close, 150));
    input.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape') { close(); }
    });
    menu.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.ac-item');
      if (!item) return;
      e.preventDefault();
      pick(Number(item.dataset.i));
    });
  }
  window.attachAutocomplete = attachAutocomplete;

  // ─── Tutor data ───
  // Curated so every course in COURSES has at least one female + one male tutor
  const TUTORS = [
    // ─ Health Management & Life Sciences
    { id: 'nina',     name: 'Nina Vogel',      gender: 'F', av: 'av-5', program: 'BSc Health Mgmt',         year: '3rd year', rating: 4.7, reviews: 29, rate: 18, langs: ['EN','DE'],
      courses: ['Organic Chemistry','General Biology','Anatomy I','Anatomy II'],
      bio: "I struggled with OChem mechanisms until I found a way to draw them as little stories. Happy to share the framework that finally made it click." },
    { id: 'mia',      name: 'Mia Hollerer',    gender: 'F', av: 'av-1', program: 'BSc Health Mgmt',         year: '3rd year', rating: 4.9, reviews: 47, rate: 22, langs: ['EN','DE'],
      courses: ['Anatomy I','Anatomy II','Biochemistry','Statistics I'],
      bio: "Aced Anatomy and Biochem in my second year — happy to walk you through the muggy bits. I love drawing things out on shared whiteboards." },
    { id: 'sophie',   name: 'Sophie Wallner',  gender: 'F', av: 'av-1', program: 'BSc Health Mgmt',         year: '4th year', rating: 4.8, reviews: 41, rate: 20, langs: ['EN','DE'],
      courses: ['Physiology','Pathology','Pharmacology','Healthcare Management','Health Economics','Anatomy I'],
      bio: "I tutored Physio and Pharma all of last semester. I focus on clinical reasoning — once the 'why' clicks, the 'what' sticks." },
    { id: 'daniel',   name: 'Daniel Kainz',    gender: 'M', av: 'av-3', program: 'BSc Health Mgmt',         year: '3rd year', rating: 4.8, reviews: 35, rate: 19, langs: ['EN','DE'],
      courses: ['Organic Chemistry','General Biology','Biochemistry','Anatomy I','Anatomy II'],
      bio: "Pre-med leaning hard into the chem side. We can go from reaction mechanisms to lab reports in the same session." },
    { id: 'matthias', name: 'Matthias Lang',   gender: 'M', av: 'av-3', program: 'MSc Med & Pharm Biotech',  year: 'MSc',      rating: 4.9, reviews: 52, rate: 26, langs: ['EN','DE'],
      courses: ['Molecular Biology','Cell Biology','Genetics','Microbiology','Immunology','Clinical Trial Management','Medical Device Regulation','Physiology','Pathology','Pharmacology'],
      bio: "Biotech master's student. I tutor everything from cell biology to regulatory affairs. Heavy on diagrams and exam pattern recognition." },
    { id: 'julia',    name: 'Julia Berger',    gender: 'F', av: 'av-4', program: 'BSc Med & Pharm Biotech',  year: '4th year', rating: 4.8, reviews: 38, rate: 23, langs: ['EN','DE'],
      courses: ['Cell Biology','Molecular Biology','Genetics','Microbiology','Immunology','Clinical Trial Management','Medical Device Regulation'],
      bio: "I work part-time in a Krems research lab. Great if you want help connecting course content to real protocols." },

    // ─ Business & Finance
    { id: 'lukas',    name: 'Lukas Brenner',   gender: 'M', av: 'av-2', program: 'BSc International Business', year: '4th year', rating: 5.0, reviews: 62, rate: 26, langs: ['EN','DE'],
      courses: ['Microeconomics','Financial Accounting','Statistics I','Statistics II'],
      bio: "Tutored 60+ students last semester. I focus on the exam patterns IMC profs reuse — once you see them, the course gets a lot easier." },
    { id: 'felix',    name: 'Felix Aigner',    gender: 'M', av: 'av-6', program: 'BSc International Business', year: '2nd year', rating: 4.8, reviews: 18, rate: 16, langs: ['EN','DE'],
      courses: ['Statistics I','Microeconomics','Mathematics','Calculus I','Programming Fundamentals'],
      bio: "Newer tutor but I just finished Stats with a 1.0. Strong on R basics and exercise-set walkthroughs." },
    { id: 'jan',      name: 'Jan Hofer',       gender: 'M', av: 'av-3', program: 'BSc International Business', year: '4th year', rating: 4.9, reviews: 44, rate: 25, langs: ['EN','DE'],
      courses: ['Macroeconomics','Microeconomics','Managerial Accounting','Corporate Finance','Business Law','International Business','Strategic Management','Operations Management','Human Resource Management','Organizational Behavior'],
      bio: "I love case-study courses. We'll work through the framework, the exam structure, and the bits profs love to grade." },
    { id: 'clara',    name: 'Clara Bauer',     gender: 'F', av: 'av-4', program: 'BSc International Business', year: '4th year', rating: 4.9, reviews: 51, rate: 24, langs: ['EN','DE'],
      courses: ['Financial Accounting','Managerial Accounting','Corporate Finance','Business Law','International Business','Macroeconomics','Microeconomics','Strategic Management','Operations Management','Human Resource Management','Organizational Behavior'],
      bio: "Accounting is my home turf — debits, credits and case studies all welcome. I keep notes in really clean spreadsheets." },

    // ─ Marketing
    { id: 'sara',     name: 'Sara Köhler',     gender: 'F', av: 'av-4', program: 'BSc Marketing',           year: '3rd year', rating: 4.8, reviews: 34, rate: 19, langs: ['EN','DE'],
      courses: ['Marketing Fundamentals','Marketing Research','Consumer Behavior','Digital Marketing','Brand Management','Academic Writing','Business English'],
      bio: "Marketing student who actually likes essays. I can help you structure case-study answers and clean up your APA citations." },
    { id: 'markus',   name: 'Markus Wagner',   gender: 'M', av: 'av-1', program: 'BSc Marketing',           year: '3rd year', rating: 4.7, reviews: 27, rate: 18, langs: ['EN','DE'],
      courses: ['Marketing Fundamentals','Marketing Research','Consumer Behavior','Digital Marketing','Brand Management'],
      bio: "I run a small Instagram side-hustle, so the digital marketing units feel like work I actually do. We can review your campaign briefs together." },

    // ─ Informatics / Programming
    { id: 'tom',      name: 'Tom Eichinger',   gender: 'M', av: 'av-3', program: 'MSc Informatics',         year: 'MSc',      rating: 4.9, reviews: 88, rate: 28, langs: ['EN'],
      courses: ['Algorithms','Algorithm Design','Data Structures','Discrete Mathematics','Software Engineering','Linear Algebra','Calculus I','Calculus II','Mathematics','Probability Theory','Statistics II','Programming in Python','Machine Learning','Data Analytics'],
      bio: "Mathy CS student. I tutor algorithms and any course with proofs. We can pair-program on Replit if that helps you learn faster." },
    { id: 'hannah',   name: 'Hannah Steiner',  gender: 'F', av: 'av-2', program: 'MSc Informatics',         year: 'MSc',      rating: 4.9, reviews: 57, rate: 26, langs: ['EN','DE'],
      courses: ['Programming Fundamentals','Programming in Python','Programming in Java','Object-Oriented Programming','Algorithms','Algorithm Design','Data Structures','Discrete Mathematics','Software Engineering','Database Systems','Web Development','Machine Learning','Data Analytics'],
      bio: "I teach programming the way I wish I'd been taught — small examples first, then we scale up to your real project." },
    { id: 'david',    name: 'David Müller',    gender: 'M', av: 'av-2', program: 'BSc Informatics',         year: '3rd year', rating: 4.8, reviews: 41, rate: 22, langs: ['EN','DE'],
      courses: ['Programming Fundamentals','Programming in Python','Programming in Java','Object-Oriented Programming','Software Engineering','Database Systems','Web Development','Project Management (IT)'],
      bio: "Half-time freelance dev. I'm pragmatic — we'll get your code working first, then make it neat." },

    // ─ Mathematics
    { id: 'lara',     name: 'Lara Pichler',    gender: 'F', av: 'av-6', program: 'BSc Applied Math',        year: '4th year', rating: 4.9, reviews: 36, rate: 22, langs: ['EN','DE'],
      courses: ['Mathematics','Calculus I','Calculus II','Linear Algebra','Probability Theory','Discrete Mathematics','Statistics I','Statistics II'],
      bio: "I love unboring math. We'll work through past exams together and I'll point out the patterns the profs reuse every year." },

    // ─ Tourism
    { id: 'elena',    name: 'Elena Rossi',     gender: 'F', av: 'av-5', program: 'BSc Tourism & Leisure',   year: '3rd year', rating: 4.7, reviews: 22, rate: 17, langs: ['EN','DE'],
      courses: ['Tourism Management','Hospitality Management','Destination Marketing','Event Management'],
      bio: "I've worked two summer seasons in Wachau. I bring real cases to every session and we work backwards from them." },
    { id: 'philipp',  name: 'Philipp Gruber',  gender: 'M', av: 'av-6', program: 'BSc Tourism & Leisure',   year: '4th year', rating: 4.8, reviews: 31, rate: 19, langs: ['EN','DE'],
      courses: ['Tourism Management','Hospitality Management','Destination Marketing','Event Management'],
      bio: "Event-management nerd. Bring me your group project and we'll structure it end-to-end." },

    // ─ Cross-program languages + writing
    { id: 'thomas',   name: 'Thomas Reiter',   gender: 'M', av: 'av-2', program: 'MA Applied Linguistics',  year: 'MA',       rating: 4.9, reviews: 46, rate: 21, langs: ['EN','DE'],
      courses: ['Academic Writing','Business English','Research Methods','German B2'],
      bio: "I edit thesis chapters for fun. We'll fix structure first, then sentences, then commas." },
    { id: 'lena',     name: 'Lena Hofbauer',   gender: 'F', av: 'av-5', program: 'BSc European Studies',    year: '4th year', rating: 4.8, reviews: 33, rate: 18, langs: ['EN','DE'],
      courses: ['German B2','Spanish A1','Business English','Academic Writing','Research Methods'],
      bio: "Spanish-German bilingual. I run speaking-only sessions so you actually leave able to talk, not just translate." }
  ];

  // Browse: render cards from TUTORS, then wire up click + filter
  function initFilters() {
    renderTutorCards();
    document.querySelectorAll('.filters input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', applyBrowseFilter);
    });
  }

  function renderTutorCards() {
    const list = document.getElementById('tutor-list');
    if (!list) return;
    list.innerHTML = TUTORS.map(t => {
      const previewChips = t.courses.slice(0, 3).map(c => `<span class="chip-mini">${c}</span>`).join('');
      const allChips = t.courses.map(c => `<span class="chip-mini">${c}</span>`).join('');
      const badge = pickBadge(t);
      return `
        <article class="tutor-card"
                 data-tutor="${t.id}"
                 data-courses="${t.courses.join(', ').toLowerCase()}"
                 data-langs="${t.langs.join(',')}"
                 data-gender="${t.gender}">
          <span class="avatar-lg ${t.av}"></span>
          <div class="body">
            <div class="name-row">
              <span class="name">${t.name}</span>
              ${badge}
            </div>
            <div class="meta">${t.program} · ${t.year} · IMC Krems · ${t.langs.join(', ')}</div>
            <div class="bio">${t.bio}</div>

            <div class="courses preview">${previewChips}${t.courses.length > 3 ? `<span class="chip-mini more">+${t.courses.length - 3} more</span>` : ''}</div>
            <div class="courses full">${allChips}</div>

            <div class="profile-strip">
              <div><span class="k">Format</span><b>Online · In person</b></div>
              <div><span class="k">Response</span><b>~2 hrs</b></div>
              <div><span class="k">Next free</span><b>Tomorrow</b></div>
              <div><span class="k">First session</span><b style="color:var(--leaf)">30 min free</b></div>
            </div>
          </div>
          <div class="right">
            <div class="stars">★★★★★ <span style="color:var(--muted-ink); font-size:12px; margin-left:4px">${t.rating.toFixed(1)} · ${t.reviews}</span></div>
            <div class="rate">€${t.rate}<span class="unit">/hr</span></div>
            <button class="btn btn-ink sm view-btn">View profile →</button>
            <button class="btn btn-coral sm book-btn" data-action="book">Book a session</button>
          </div>
        </article>`;
    }).join('');

    // Wire card clicks
    list.querySelectorAll('.tutor-card').forEach(card => {
      const open = () => {
        const id = card.dataset.tutor;
        state.tutor = TUTORS.find(t => t.id === id);
        go('tutor');
      };
      const book = () => {
        const id = card.dataset.tutor;
        state.tutor = TUTORS.find(t => t.id === id);
        go('slot');
      };
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="book"]')) { e.stopPropagation(); book(); return; }
        if (e.target.closest('[data-go]')) return;
        open();
      });
    });
  }

  function pickBadge(t) {
    if (t.rating >= 4.95) return '<span class="badge badge-coral"><span class="badge-dot"></span>Top rated</span>';
    if (t.reviews < 25)   return '<span class="badge"><span class="badge-dot"></span>New</span>';
    if (t.reviews >= 50)  return '<span class="badge badge-leaf"><span class="badge-dot"></span>Verified · Grade 1</span>';
    return '';
  }
  function renderResultsCount() {
    const q = (state.course || '').trim();
    const count = document.querySelectorAll('.tutor-card:not([hidden])').length;
    const el = document.getElementById('results-count');
    if (el) {
      el.innerHTML = q
        ? count + ' <em>' + (count === 1 ? 'tutor' : 'tutors') + '</em>'
        : 'Start by <em>searching a course</em>';
    }
    // Empty state
    let empty = document.getElementById('browse-empty');
    if (!q) {
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'browse-empty';
        empty.className = 'card';
        empty.style.cssText = 'text-align:center; padding:48px 24px';
        empty.innerHTML =
          '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-ink); margin-bottom:14px"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>' +
          '<div style="font-family:var(--display); font-size:30px; margin-bottom:6px">Search for a course</div>' +
          '<p class="muted" style="margin:0 auto 18px; max-width:380px">Type the course you need help with above. We\'ll show you verified IMC Krems students who took it last semester.</p>' +
          '<div class="chips" style="justify-content:center; gap:8px"></div>';
        document.querySelector('.tutor-list')?.appendChild(empty);
        // Populate quick-suggestion chips
        const chipBox = empty.querySelector('.chips');
        ['Organic Chemistry','Statistics I','Programming in Python','Calculus I','Microeconomics','Anatomy I'].forEach(name => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'chip';
          b.textContent = name;
          b.addEventListener('click', () => {
            state.course = name;
            applyBrowseFilter();
          });
          chipBox.appendChild(b);
        });
      } else { empty.hidden = false; empty.innerHTML = empty.innerHTML; }
      empty.hidden = false;
      // Re-style header for "no search" state
      const title = document.getElementById('browse-title');
      if (title) title.innerHTML = 'Find a <em>tutor</em>';
    } else if (count === 0) {
      // Search query with no matches
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'browse-empty';
        empty.className = 'card';
        empty.style.cssText = 'text-align:center; padding:48px 24px';
        document.querySelector('.tutor-list')?.appendChild(empty);
      }
      empty.hidden = false;
      empty.innerHTML =
        '<div style="font-family:var(--display); font-size:28px; margin-bottom:8px">No tutors yet for "' + escapeHtml(q) + '"</div>' +
        '<p class="muted" style="margin:0 0 18px">Try a related course, or <a href="#home" data-go="home" style="text-decoration:underline; cursor:pointer">refer a tutor</a> to earn credit.</p>';
    } else if (empty) {
      empty.hidden = true;
    }
  }

  // ─── Tutor profile ───
  function initTutorTabs() {
    document.querySelectorAll('.profile-tabs button').forEach(b => {
      b.addEventListener('click', () => {
        const n = b.dataset.section;
        document.querySelectorAll('.profile-tabs button').forEach(x => x.classList.toggle('is-active', x === b));
        document.querySelectorAll('.profile-section').forEach(s => s.classList.toggle('is-active', s.dataset.section === n));
      });
    });
  }
  function renderTutorProfile() {
    const t = state.tutor || TUTORS[0];
    state.tutor = t;
    const set = (sel, val) => document.querySelectorAll(sel).forEach(el => el.textContent = val);
    set('[data-bind="tutor-name"]', t.name);
    set('[data-bind="tutor-role"]', t.course + ' · ' + t.year + ' · IMC Krems');
    set('[data-bind="tutor-bio"]',  t.bio);
    set('[data-bind="tutor-rating"]', t.rating.toFixed(1));
    set('[data-bind="tutor-reviews"]', t.reviews + ' reviews');
    set('[data-bind="tutor-rate"]', '€' + t.rate);
    document.querySelectorAll('[data-bind="tutor-avatar"]').forEach(el => {
      el.className = el.className.replace(/av-\d/g, '') + ' ' + t.av;
    });
  }

  // ─── Calendar ───
  function initCalendar() {
    document.querySelectorAll('.cal-grid .slot:not(.is-taken):not(.empty)').forEach(s => {
      s.addEventListener('click', () => {
        document.querySelectorAll('.cal-grid .slot').forEach(x => x.classList.remove('is-selected'));
        s.classList.add('is-selected');
        state.slot = {
          day: s.dataset.day, date: s.dataset.date, time: s.dataset.time
        };
        renderSlotSummary();
      });
    });
  }
  function renderSlotSummary() {
    const card = document.getElementById('slot-summary');
    const cta = document.getElementById('slot-continue');
    const tutorBox = document.getElementById('slot-tutor');
    if (!card) return;
    const t = state.tutor || TUTORS[0];
    if (tutorBox) {
      tutorBox.innerHTML = '<span class="avatar-md ' + t.av + '"></span>' +
        '<div><div style="font-weight:600">' + t.name + '</div>' +
        '<div class="muted" style="font-size:13px">€' + t.rate + '/hr · ' + (t.langs || []).join(', ') + '</div></div>';
    }
    if (state.slot) {
      card.classList.remove('empty');
      card.innerHTML = '<b>' + state.slot.day + ', ' + state.slot.date + '</b>' +
        state.slot.time + ' — ' + addMinutes(state.slot.time, state.duration);
      cta.removeAttribute('disabled');
    } else {
      card.classList.add('empty');
      card.innerHTML = '<b style="color:inherit">No slot selected</b>Pick a time from the calendar to continue.';
      cta.setAttribute('disabled', 'true');
    }
  }
  function addMinutes(hhmm, mins) {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + mins;
    const nh = String(Math.floor(total / 60)).padStart(2, '0');
    const nm = String(total % 60).padStart(2, '0');
    return nh + ':' + nm;
  }

  // ─── Format picker ───
  function initFormatPicker() {
    document.querySelectorAll('.format-card').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.format-card').forEach(x => x.classList.toggle('is-on', x === c));
        state.format = c.dataset.format;
        renderDetailsSummary();
      });
    });
    document.querySelectorAll('.duration-chips .chip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.duration-chips .chip').forEach(x => x.classList.toggle('is-on', x === c));
        state.duration = Number(c.dataset.duration);
        renderDetailsSummary();
      });
    });
    document.querySelectorAll('#materials-chips .chip').forEach(c => {
      c.addEventListener('click', () => c.classList.toggle('is-on'));
    });
    const topic = document.getElementById('topic-input');
    if (topic) topic.addEventListener('input', () => { state.topic = topic.value; });
    const courseField = document.getElementById('details-course');
    if (courseField) {
      courseField.addEventListener('input', () => {
        state.course = courseField.value;
        renderDetailsSummary();
      });
    }
  }
  function renderDetailsSummary() {
    const t = state.tutor || TUTORS[0];
    const s = state.slot || { day: 'Tue', date: 'May 26', time: '14:00' };

    // Sync inputs and tutor recap with current state
    const courseInput = document.getElementById('details-course');
    if (courseInput && !courseInput.value) {
      courseInput.value = state.course || (t.courses && t.courses[0]) || '';
      state.course = courseInput.value;
    }
    const recap = document.getElementById('details-tutor-recap');
    if (recap) {
      recap.innerHTML =
        '<div class="row" style="gap:14px; align-items:center">' +
          '<span class="avatar-md ' + t.av + '"></span>' +
          '<div style="flex:1">' +
            '<div style="font-weight:600; font-size:15px">' + t.name + '</div>' +
            '<div class="muted" style="font-size:13px">' + t.program + ' · ' + t.year + ' · ' + t.langs.join(', ') + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div class="stars" style="font-size:12px">★★★★★ <span style="color:var(--muted-ink); margin-left:2px">' + t.rating.toFixed(1) + ' · ' + t.reviews + '</span></div>' +
            '<div class="muted" style="font-size:12.5px; margin-top:2px">€' + t.rate + '/hr</div>' +
          '</div>' +
        '</div>';
    }

    // Sidebar summary
    const box = document.getElementById('details-summary');
    if (!box) return;
    const total = (t.rate * state.duration / 60).toFixed(2);
    box.innerHTML =
      '<div class="row" style="gap:12px; margin-bottom:14px">' +
        '<span class="avatar-md ' + t.av + '"></span>' +
        '<div><div style="font-weight:600">' + t.name + '</div>' +
        '<div class="muted" style="font-size:13px">' + t.program + '</div></div>' +
      '</div>' +
      '<div class="summary">' +
      '<div class="line"><span class="k">Course</span><span>' + (state.course || '—') + '</span></div>' +
      '<div class="line"><span class="k">When</span><span>' +
        s.day + ', ' + s.date + ' · ' + s.time + '</span></div>' +
      '<div class="line"><span class="k">Duration</span><span>' + state.duration + ' min</span></div>' +
      '<div class="line"><span class="k">Format</span><span>' + (state.format === 'online' ? 'Online (Zoom)' : 'In person · IMC Library') + '</span></div>' +
      '<div class="line total"><span>Estimated</span><span>€' + total + '</span></div></div>';
  }

  // ─── Payment ───
  function initPayTabs() {
    document.querySelectorAll('.pay-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.pay-tab').forEach(x => x.classList.toggle('is-on', x === t));
      });
    });
  }
  function renderCheckoutSummary() {
    const box = document.getElementById('checkout-summary');
    if (!box) return;
    const t = state.tutor || TUTORS[0];
    const s = state.slot || { day: 'Tue', date: 'May 26', time: '14:00' };
    const sub = t.rate * state.duration / 60;
    const fee = 1.50;
    const total = (sub + fee).toFixed(2);
    box.innerHTML =
      '<div class="session-recap">' +
        '<span class="avatar-md ' + t.av + '"></span>' +
        '<div><b>' + t.name + '</b>' +
        '<div class="meta">' + s.day + ', ' + s.date + ' · ' + s.time + ' · ' + state.duration + ' min</div>' +
        '<div class="meta">' + (state.format === 'online' ? 'Online (Zoom)' : 'In person · IMC Library') + '</div></div>' +
      '</div>' +
      '<div class="summary">' +
        '<div class="line"><span class="k">Session (' + state.duration + ' min @ €' + t.rate + '/hr)</span><span>€' + sub.toFixed(2) + '</span></div>' +
        '<div class="line"><span class="k">Platform fee</span><span>€' + fee.toFixed(2) + '</span></div>' +
        '<div class="line"><span class="k">First-time student credit</span><span style="color:var(--leaf)">−€5.00</span></div>' +
        '<div class="line total"><span>Total today</span><span>€' + (Number(total) - 5).toFixed(2) + '</span></div>' +
      '</div>';
  }

  function renderConfirmation() {
    const box = document.getElementById('confirm-detail');
    if (!box) return;
    const t = state.tutor || TUTORS[0];
    const s = state.slot || { day: 'Tue', date: 'May 26', time: '14:00' };
    box.innerHTML =
      '<div class="row-info"><span class="k">Tutor</span><span><b>' + t.name + '</b> · €' + t.rate + '/hr</span></div>' +
      '<div class="row-info"><span class="k">Session</span><span>' + state.course + ' — ' + (state.topic || 'Exam prep') + '</span></div>' +
      '<div class="row-info"><span class="k">When</span><span>' + s.day + ', ' + s.date + ' · ' + s.time + ' (' + state.duration + ' min)</span></div>' +
      '<div class="row-info"><span class="k">Where</span><span>' + (state.format === 'online' ? 'Zoom — link in your email' : 'IMC Krems Library, Group Room B') + '</span></div>' +
      '<div class="row-info"><span class="k">Receipt</span><span>Sent to <b>you@imc.ac.at</b></span></div>';
  }

  // ─── My sessions dashboard ───
  function renderSessions() {
    const t = state.tutor || TUTORS[0];
    const s = state.slot || { day: 'Tue', date: 'May 26', time: '14:00' };
    const upcoming = document.getElementById('upcoming-list');
    if (!upcoming) return;
    upcoming.innerHTML = `
      <div class="session-item upcoming">
        <div class="when"><span class="small">${s.day}</span>${s.date.split(' ')[1] || '26'}</div>
        <div>
          <div class="with">${state.course || (t.courses && t.courses[0]) || 'Session'} with ${t.name}</div>
          <div class="topic">${s.time} · ${state.duration} min · ${state.format === 'online' ? 'Online' : 'In person'}</div>
        </div>
        <button class="btn btn-outline sm" data-go="confirmed" href="#confirmed">View</button>
      </div>
      <div class="session-item">
        <div class="when"><span class="small">Thu</span>28</div>
        <div>
          <div class="with">Statistics with Lukas Brenner</div>
          <div class="topic">11:00 · 60 min · Online</div>
        </div>
        <button class="btn btn-outline sm">Manage</button>
      </div>
    `;
  }

  // ─── Apply to become a tutor ───
  const applyState = {
    first: '', last: '', email: '',
    program: 'BSc International Business',
    year: 'Year 3',
    langs: ['EN', 'DE'],
    courses: [],
    rate: 22,
    format: 'online',
    bio: '',
    av: 'av-1'
  };
  window.applyState = applyState;

  function initApply() {
    // Text/select fields → state
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        applyState[key] = el.value;
        renderApplyPreview();
      });
    };
    bind('apply-first', 'first');
    bind('apply-last', 'last');
    bind('apply-email', 'email');
    bind('apply-program', 'program');
    bind('apply-year', 'year');
    bind('apply-bio', 'bio');

    // Language chips
    document.querySelectorAll('#apply-langs .chip').forEach(c => {
      c.addEventListener('click', () => {
        c.classList.toggle('is-on');
        applyState.langs = [...document.querySelectorAll('#apply-langs .chip.is-on')].map(x => x.dataset.lang);
        renderApplyPreview();
      });
    });

    // Format
    document.querySelectorAll('.format-card[data-apply-format]').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.format-card[data-apply-format]').forEach(x => x.classList.toggle('is-on', x === c));
        applyState.format = c.dataset.applyFormat;
        renderApplyPreview();
      });
    });

    // Rate slider
    const slider = document.getElementById('applyRateSlider');
    if (slider) {
      const value = document.getElementById('applyRateValue');
      const net = document.getElementById('applyRateNet');
      const update = () => {
        const v = Number(slider.value);
        const min = Number(slider.min), max = Number(slider.max);
        slider.style.setProperty('--fill', (((v - min) / (max - min)) * 100) + '%');
        value.textContent = v;
        net.textContent = '€' + (v * 0.85).toFixed(2) + '/hr';
        applyState.rate = v;
        renderApplyPreview();
      };
      slider.addEventListener('input', update);
      update();
    }

    // Course autocomplete → add as chip
    const courseSearch = document.getElementById('apply-course-search');
    if (courseSearch) {
      attachAutocomplete(courseSearch, {
        onPick: (c) => {
          if (!applyState.courses.includes(c.name)) {
            applyState.courses.push(c.name);
          }
          courseSearch.value = '';
          renderApplyCourses();
          renderApplyPreview();
        }
      });
    }
  }

  function renderApplyCourses() {
    const box = document.getElementById('apply-courses');
    const empty = document.getElementById('apply-courses-empty');
    if (!box) return;
    box.innerHTML = applyState.courses.map(c =>
      `<button type="button" class="chip is-on" data-course="${c}">${c} <span style="opacity:0.7; margin-left:6px">×</span></button>`
    ).join('');
    box.querySelectorAll('.chip').forEach(b => {
      b.addEventListener('click', () => {
        applyState.courses = applyState.courses.filter(c => c !== b.dataset.course);
        renderApplyCourses();
        renderApplyPreview();
      });
    });
    if (empty) empty.style.display = applyState.courses.length ? 'none' : 'block';
  }

  function pickBadge(t) {
    if (t.rating >= 4.95) return '<span class="badge badge-coral"><span class="badge-dot"></span>Top rated</span>';
    if (t.reviews < 25)   return '<span class="badge"><span class="badge-dot"></span>New</span>';
    if (t.reviews >= 50)  return '<span class="badge badge-leaf"><span class="badge-dot"></span>Verified · Grade 1</span>';
    return '';
  }
  // Note: pickBadge already exists earlier; redefining here is safe (overwrites)
  // — we keep it so renderApplyPreview is self-contained.

  function renderApplyPreview() {
    const card = document.getElementById('apply-card-preview');
    if (!card) return;
    const a = applyState;
    const fullname = ((a.first || '') + ' ' + (a.last || '')).trim() || 'Your name';
    const courseChips = a.courses.length
      ? a.courses.map(c => `<span class="chip-mini">${c}</span>`).join('')
      : '<span class="chip-mini" style="background:transparent; border:1px dashed var(--line-2); color:var(--muted-ink)">No courses yet</span>';
    const langs = a.langs.length ? a.langs.join(', ') : 'No languages selected';
    const formatLabel = a.format === 'online' ? 'Online' : a.format === 'in-person' ? 'In person' : 'Online · In person';
    const bio = a.bio || 'Your bio will appear here. Write a few lines about how you study and how you like to tutor.';

    card.innerHTML = `
      <span class="avatar-lg ${a.av}"></span>
      <div class="body">
        <div class="name-row">
          <span class="name">${fullname}</span>
          <span class="badge"><span class="badge-dot"></span>New</span>
        </div>
        <div class="meta">${a.program} · ${a.year} · IMC Krems · ${langs}</div>
        <div class="bio">${bio}</div>
        <div class="courses full" style="display:flex">${courseChips}</div>
        <div class="profile-strip">
          <div><span class="k">Format</span><b>${formatLabel}</b></div>
          <div><span class="k">Response</span><b>—</b></div>
          <div><span class="k">Next free</span><b>Once approved</b></div>
          <div><span class="k">First session</span><b style="color:var(--leaf)">30 min free</b></div>
        </div>
      </div>
      <div class="right">
        <div class="stars" style="color:var(--cream-3)">★★★★★ <span style="color:var(--muted-ink); font-size:12px; margin-left:4px">No reviews yet</span></div>
        <div class="rate">€${a.rate}<span class="unit">/hr</span></div>
        <button class="btn btn-ink sm" style="opacity:0.5; cursor:default">Pending review</button>
      </div>`;
  }

  function renderApplySent() {
    const el = document.getElementById('apply-sent-email');
    if (el && applyState.email) el.textContent = applyState.email;
  }
})();
