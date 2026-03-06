const initialCourses = [
    {
        id: '1',
        code: 'SC3010',
        title: 'Computer Security',
        term: '2025-s2',
        favourite: true,
        instructors: ['Luiz Fernando', 'Smith John'],
        image: 'https://picsum.photos/seed/sc3010/600/300'
    },
    {
        id: '2',
        code: 'SC2002',
        title: 'Object Oriented Design and Programming',
        term: '2026-s1',
        favourite: true,
        instructors: ['Multiple Instructors'],
        image: 'https://picsum.photos/seed/sc2002/600/300'
    },
    {
        id: '3',
        code: 'SC2006',
        title: 'Software Engineering',
        term: '2026-s1',
        favourite: false,
        instructors: ['Jane Doe'],
        image: 'https://picsum.photos/seed/sc2006/600/300'
    },
    {
        id: '4',
        code: 'MH1810',
        title: 'Mathematics I',
        term: '2025-s2',
        favourite: true,
        instructors: ['Alan Turing'],
        image: 'https://picsum.photos/seed/mh1810/600/300'
    },
    {
        id: '5',
        code: 'EE2008',
        title: 'Data Structures and Algorithms',
        term: '2026-s1',
        favourite: false,
        instructors: ['Navin Kumar', 'Jane Smith'],
        image: 'https://picsum.photos/seed/ee2008/600/300'
    }
];

// Generate more placeholder courses to test pagination
let extraItems = [];
for (let i = 6; i <= 35; i++) {
    extraItems.push({
        id: String(i),
        code: `EL${1000 + i}`,
        title: `Elective Subject ${i}`,
        term: i % 2 === 0 ? '2026-s1' : '2025-s2',
        favourite: i % 5 === 0,
        instructors: ['Instructor ' + i],
        image: `https://picsum.photos/seed/el${i}/600/300`
    });
}
const allCourses = [...initialCourses, ...extraItems];

const state = {
    courses: allCourses,
    viewMode: 'grid', // 'grid' | 'list'
    searchQuery: '',
    termFilter: 'all',
    typeFilter: 'all',
    itemsPerPage: 25,
    // --- NorthStar SPA State ---
    activeTab: 'view-courses',
    sidebarExpanded: true,
    isStudyMode: false,

    // --- KHAN ACADEMY / STUDY MODE STATE ---
    todayPlan: [
        { id: 'p1', timeStart: '09:00', timeEnd: '10:00', subjectTitle: 'SC3010: Software Security', status: 'active', subjectId: 'subj1' },
        { id: 'p2', timeStart: '10:00', timeEnd: '11:00', subjectTitle: 'SC2002: Polymorphism', status: 'pending', subjectId: 'subj2' },
        { id: 'p3', timeStart: '13:00', timeEnd: '14:30', subjectTitle: 'SC2006: Design Patterns', status: 'pending', subjectId: 'subj3' }
    ],
    todayProgressPct: 42,
    subjects: {
        'subj1': {
            id: 'subj1',
            title: 'Non-contact interactions',
            breadcrumb: "Physics > Forces and Newton's laws of motion",
            units: [
                { id: 'u1', title: 'Motion and forces' },
                { id: 'u2', title: 'Non-contact interactions' },
                { id: 'u3', title: 'Energy' }
            ],
            lessons: [
                { id: 'l1', unitId: 'u2', type: 'video', title: 'Intro to gravity', duration: '8m', status: 'done', content: 'https://picsum.photos/seed/grav/800/450' },
                { id: 'l2', unitId: 'u2', type: 'reading', title: 'Newton\'s law of universal gravitation', duration: '10m', status: 'pending', content: 'Newton\'s law of universal gravitation states that every particle attracts every other particle in the universe with a force proportional to the product of their masses and inversely proportional to the square of the distance between their centers. \n\nFormula: F = G * (m1 * m2) / r^2' },
                { id: 'l3', unitId: 'u2', type: 'activity', title: 'Practice: Gravity interactions', duration: '15m', status: 'pending', content: 'Interactive gravity simulator (Mock).' }
            ],
            practiceCards: [
                { id: 'prac1', status: 'up-next', title: 'Gravity equations' },
                { id: 'prac2', status: 'not-started', title: 'Planetary orbits' }
            ]
        },
        'subj2': { id: 'subj2', title: 'Calculus: Optimization', breadcrumb: 'Math', units: [], lessons: [], practiceCards: [] },
        'subj3': { id: 'subj3', title: 'Data Structures: Graphs', breadcrumb: 'Computer Science', units: [], lessons: [], practiceCards: [] },
    },
    selectedSubjectId: 'subj1',
    selectedUnitId: 'u2',
    selectedLessonId: 'l2',
    quizActive: false,
    quizCurrentQuestion: 1,
    quizScore: 0,
    tags: [
        { name: 'SC2207', color: '#b48a71', badgeColor: '#b48a71' },
        { name: 'SC3010', color: '#F97316', badgeColor: '#F97316' }, // Security
        { name: 'SC2006', color: '#F97316', badgeColor: '#F97316' }, // Engineering
        { name: 'SC2002', color: '#8B5CF6', badgeColor: '#8B5CF6' }, // Programming
        { name: 'MH1810', color: '#8B5CF6', badgeColor: '#8B5CF6' }, // Math
        { name: 'HE3010', color: '#a17bc9', badgeColor: '#a17bc9' },
        { name: 'HW0288', color: '#679e78', badgeColor: '#679e78' },
        { name: 'SC2079', color: '#888888', badgeColor: '#888888' }
    ],
    currentEditTag: null,
    // --- TIMEMAP / CALENDAR STATE ---
    calendarBlocks: [
        // ── SC3010: Computer Security ──
        { id: 'c_sc3010_lec_mon', title: 'SC3010: Computer Security', day: 0, kind: 'lecture', startMin: 600, endMin: 720, code: 'LEC' }, // Mon 10–12
        { id: 'c_sc3010_tut_wed', title: 'SC3010: Computer Security', day: 2, kind: 'tutorial', startMin: 780, endMin: 840, code: 'TUT' }, // Wed 13–14
        { id: 'c_sc3010_lab_fri', title: 'SC3010: Computer Security', day: 4, kind: 'lab', startMin: 540, endMin: 660, code: 'LAB' }, // Fri 09–11

        // ── SC2002: OOP ──
        { id: 'c_sc2002_lec_mon', title: 'SC2002: OOP', day: 0, kind: 'lecture', startMin: 780, endMin: 900, code: 'LEC' }, // Mon 13–15
        { id: 'c_sc2002_tut_thu', title: 'SC2002: OOP', day: 3, kind: 'tutorial', startMin: 600, endMin: 660, code: 'TUT' }, // Thu 10–11
        { id: 'c_sc2002_lab_thu', title: 'SC2002: OOP', day: 3, kind: 'lab', startMin: 660, endMin: 780, code: 'LAB' }, // Thu 11–13

        // ── SC2006: Software Engineering ──
        { id: 'c_sc2006_lec_wed', title: 'SC2006: Software Engineering', day: 2, kind: 'lecture', startMin: 540, endMin: 660, code: 'LEC' }, // Wed 09–11
        { id: 'c_sc2006_tut_fri', title: 'SC2006: Software Engineering', day: 4, kind: 'tutorial', startMin: 720, endMin: 780, code: 'TUT' }, // Fri 12–13

        // ── Study Sessions — populated by backend (see fetchAndApplyBackendData) ──
    ]
};

function init() {
    // Check which page we are on
    const isStudyPage = document.querySelector('.ns-app') !== null;

    if (isStudyPage) {
        state.isStudyMode = false;
        state.activeTab = 'view-courses';
        bindNsAppEvents();
        renderNsAppCourses();
        // Globally render the timeline and progress bar in the sidebar
        renderStudySidebar();

        playCinematicReveal();
        fetchAndApplyBackendData();
    } else {
        bindEvents();
        render();
        // Also bind the toggle button to go to study mode
        const toggleBtn = document.getElementById('ns-toggle') || document.getElementById('north-star-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                playCinematicTransition(() => {
                    window.location.href = 'study.html';
                });
            });
        }
    }
}

function bindEvents() {
    // View toggles
    document.getElementById('view-grid').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('view-list').addEventListener('click', () => setViewMode('list'));

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        render();
    });

    // Filters
    document.getElementById('term-filter').addEventListener('change', (e) => {
        state.termFilter = e.target.value;
        render();
    });

    document.getElementById('course-filter').addEventListener('change', (e) => {
        state.typeFilter = e.target.value;
        render();
    });

    document.getElementById('items-per-page-select').addEventListener('change', (e) => {
        state.itemsPerPage = parseInt(e.target.value, 10);
        render();
    });
}

function setViewMode(mode) {
    state.viewMode = mode;
    document.getElementById('view-grid').classList.toggle('active', mode === 'grid');
    document.getElementById('view-list').classList.toggle('active', mode === 'list');
    render();
}

function toggleFavourite(id) {
    const course = state.courses.find(c => c.id === id);
    if (course) {
        course.favourite = !course.favourite;
        render();
    }
}

function render() {
    // Apply filters
    const filteredCourses = state.courses.filter(course => {
        // Search filter (title or code)
        if (state.searchQuery) {
            const matchTitle = course.title.toLowerCase().includes(state.searchQuery);
            const matchCode = course.code.toLowerCase().includes(state.searchQuery);
            if (!matchTitle && !matchCode) return false;
        }

        // Term filter
        if (state.termFilter !== 'all' && course.term !== state.termFilter) {
            return false;
        }

        // Type filter (favourites)
        if (state.typeFilter === 'favorites' && !course.favourite) {
            return false;
        }

        return true;
    });

    // Update results count
    const resultsCountEl = document.getElementById('results-count');
    resultsCountEl.textContent = `${filteredCourses.length} results`;

    // Apply pagination
    const coursesToShow = filteredCourses.slice(0, state.itemsPerPage);

    // Update grid container class based on view mode
    const gridEl = document.getElementById('course-grid');
    gridEl.className = `courses-grid ${state.viewMode}-view`;

    // Check if we are showing only favourites or all
    const sectionTitleEl = document.querySelector('.section-title');
    if (state.typeFilter === 'favorites') {
        sectionTitleEl.textContent = 'Favourites';
    } else {
        sectionTitleEl.textContent = 'Courses';
    }

    // Render cards
    gridEl.innerHTML = '';

    if (coursesToShow.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-muted);">No courses found matching your criteria.</div>';
        return;
    }

    coursesToShow.forEach(course => {
        const card = document.createElement('article');
        card.className = 'course-card';

        let instructorsText = course.instructors[0];
        if (course.instructors.length > 1) {
            instructorsText = 'Multiple Instructors';
        }

        const favBtnClass = course.favourite ? 'fav-btn active' : 'fav-btn';

        card.innerHTML = `
            <div class="card-image" style="background-image: url('${course.image}')" role="img" aria-label="Course image cover"></div>
            <div class="card-content">
                <div class="course-code">${course.code}</div>
                <h3 class="course-title" title="${course.title}">${course.title}</h3>
                <div class="course-links">
                    <a href="#" class="open-link">Open</a>
                    <a href="#" class="instructor-link">${instructorsText}</a>
                </div>
                <button class="${favBtnClass}" data-id="${course.id}" aria-label="${course.favourite ? 'Remove from favourites' : 'Add to favourites'}">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="${course.favourite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>
            </div>
        `;

        gridEl.appendChild(card);
    });

    // Re-bind favourite buttons
    document.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            toggleFavourite(id);
        });
    });
}

/* ========================================================= */
/* NORTH STAR MODE LOGIC & MOCK DATA                       */
/* ========================================================= */

state.northStarSchedule = [
    {
        id: 's1', type: 'video', title: 'Lecture 5: Overfitting', timeRange: '09:00 - 09:25', durationMinutes: 25, status: 'not_started',
        varkRecommendations: {
            visual: { study: 20, break: 5, tip: 'Focus on the learning curve diagrams showing training vs validation error.' },
            audio: { study: 25, break: 0, tip: 'Listen closely to the explanation of high variance.' },
            reading: { study: 15, break: 5, tip: 'Read the summary of bias vs variance tradeoffs.' },
            kinesthetic: { study: 30, break: 5, tip: 'Draw your own underfitting and overfitting graphs.' }
        }
    },
    {
        id: 's2', type: 'notes', title: 'Overfitting Summary Notes', timeRange: '09:30 - 09:45', durationMinutes: 15, status: 'in_progress',
        varkRecommendations: {
            visual: { study: 10, break: 5, tip: 'Highlight key terms (Bias, Variance) in different colors.' },
            audio: { study: 15, break: 0, tip: 'Read the notes aloud to reinforce memory.' },
            reading: { study: 15, break: 0, tip: 'Skim the bold text first before deep reading.' },
            kinesthetic: { study: 20, break: 5, tip: 'Re-type or handwrite notes to solidify understanding.' }
        }
    },
    {
        id: 's3', type: 'quiz', title: 'Check Knowledge: Bias-Variance tradeoff', timeRange: '10:00 - 10:15', durationMinutes: 15, status: 'not_started',
        varkRecommendations: {
            visual: { study: 10, break: 5, tip: 'Visualize the options graphically before selecting.' },
            audio: { study: 10, break: 5, tip: 'Say the answer out loud.' },
            reading: { study: 15, break: 0, tip: 'Carefully read each option to avoid trick questions.' },
            kinesthetic: { study: 15, break: 0, tip: 'Use the process of elimination actively.' }
        }
    },
    {
        id: 's4', type: 'recall', title: 'Flashcards: ML Basics', timeRange: '10:15 - 10:30', durationMinutes: 15, status: 'not_started',
        varkRecommendations: {
            visual: { study: 10, break: 5, tip: 'Imagine the concept as an image before revealing.' },
            audio: { study: 10, break: 5, tip: 'Explain the concept aloud like teaching someone else.' },
            reading: { study: 15, break: 0, tip: 'Read the answer twice to retain it.' },
            kinesthetic: { study: 15, break: 0, tip: 'Write the answer down before revealing the card.' }
        }
    }
];

state.isNorthStar = false;
state.selectedScheduleItemId = 's2';
state.selectedTab = 'notes';
state.selectedVarkMode = 'visual';
state.focusSessionNumber = 3;
state.ignoreRewardCount = 2;
state.quizCurrentQuestion = 1;



function playCinematicTransition(callback) {
    const overlay = document.getElementById('cinematic-overlay');
    const bgRect = document.getElementById('cinematic-bg-rect');
    const starsContainer = document.getElementById('cinematic-stars');
    const holeCircle = document.getElementById('hole-circle');

    if (!overlay || !bgRect || !holeCircle) return callback();

    overlay.classList.add('active');

    // Reset hole
    holeCircle.style.r = '0';
    holeCircle.style.transition = 'none';

    requestAnimationFrame(() => {
        bgRect.classList.add('fade-in');

        setTimeout(() => {
            const numSparkles = 25;
            for (let i = 0; i < numSparkles; i++) {
                const sp = document.createElement('div');
                sp.className = 'cinematic-sparkle';
                const rand = Math.random();
                if (rand > 0.7) sp.classList.add('small');
                else if (rand > 0.9) sp.classList.add('large');

                sp.style.left = Math.random() * 100 + 'vw';
                sp.style.top = Math.random() * 100 + 'vh';
                sp.style.animationDelay = (Math.random() * 0.4) + 's';
                starsContainer.appendChild(sp);
            }
        }, 300);

        setTimeout(() => {
            callback();
        }, 1400); // Wait for stars to finish before redirecting
    });
}

function playCinematicReveal() {
    const overlay = document.getElementById('cinematic-overlay');
    const bgRect = document.getElementById('cinematic-bg-rect');
    const holeCircle = document.getElementById('hole-circle');

    if (!overlay || !bgRect || !holeCircle) return;

    // Start fully black
    overlay.classList.add('active');
    bgRect.classList.add('fade-in');
    bgRect.style.transition = 'none';

    // Tiny delay to ensure DOM is settled
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            holeCircle.style.transition = 'r 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            holeCircle.style.r = '150vmax';

            setTimeout(() => {
                overlay.classList.remove('active');
                bgRect.classList.remove('fade-in');
                bgRect.style.transition = '';
            }, 850);
        });
    });
}

function completeLesson() {
    const subj = state.subjects[state.selectedSubjectId];
    if (!subj) return;
    const lesson = subj.lessons.find(l => l.id === state.selectedLessonId);
    if (lesson && lesson.status !== 'done') {
        lesson.status = 'done';
        state.todayProgressPct = Math.min(100, (state.todayProgressPct || 42) + 15);
        renderStudySidebar();
        renderKALayout();
    }
}

function renderStudySidebar() {
    // 1. Progress Indicator
    const pctEl = document.getElementById('ns-progress-pct');
    if (pctEl) pctEl.textContent = (state.todayProgressPct || 42) + '%';
    const fillEl = document.getElementById('ns-progress-bar-fill');
    if (fillEl) fillEl.style.width = (state.todayProgressPct || 42) + '%';

    // 2. Timeline
    const timelineEl = document.getElementById('ns-study-timeline');
    if (timelineEl) {
        timelineEl.innerHTML = state.todayPlan.map(plan => {
            const parts = plan.subjectTitle.split(': ');
            const titleHtml = parts.length > 1
                ? `<div class="ns-timeline-code">${parts[0]}</div><div class="ns-timeline-name">${parts[1]}</div>`
                : `<div class="ns-timeline-code">${plan.subjectTitle}</div>`;
            return `
            <li class="ns-timeline-item ${plan.status === 'active' ? 'active' : ''} ${plan.status === 'done' ? 'done' : ''}" onclick="selectPlanSubject('${plan.subjectId}', '${plan.id}')">
                <div class="ns-timeline-dot"></div>
                <div class="ns-timeline-time">${plan.timeStart} - ${plan.timeEnd}</div>
                <div class="ns-timeline-title">${titleHtml}</div>
            </li>
        `}).join('');
    }
}

function selectPlanSubject(subjId, planId) {
    state.selectedSubjectId = subjId;
    state.selectedUnitId = '';
    state.selectedLessonId = '';

    const subj = state.subjects[subjId];
    if (subj && subj.units.length > 0) {
        state.selectedUnitId = subj.units[0].id;
        if (subj.lessons.length > 0) {
            state.selectedLessonId = subj.lessons[0].id;
        }
    }

    state.todayPlan.forEach(p => p.status = (p.id === planId) ? 'active' : (p.status === 'active' ? 'pending' : p.status));
    renderStudySidebar();
    renderKALayout();
}

function renderKALayout() {
    const subj = state.subjects[state.selectedSubjectId];
    if (!subj) return;

    document.getElementById('ns-dd-breadcrumb').textContent = subj.breadcrumb;
    document.getElementById('ns-dd-title').textContent = subj.title;

    // Left Col: Units
    const unitsList = document.getElementById('ns-ka-units-list');
    if (unitsList) {
        unitsList.innerHTML = subj.units.map(u => `
            <li class="ns-ka-nav-item ${state.selectedUnitId === u.id ? 'active' : ''}" onclick="state.selectedUnitId='${u.id}'; renderKALayout();">${u.title}</li>
        `).join('');
    }

    // Center Col: Lessons
    const lessonSection = document.getElementById('ns-learn-section');
    const contentViewer = document.getElementById('ns-content-viewer');
    const lessonItemsList = document.getElementById('ns-lesson-items');

    const unitLessons = subj.lessons.filter(l => l.unitId === state.selectedUnitId);
    if (unitLessons.length > 0) {
        document.getElementById('ns-lesson-title').textContent = subj.units.find(u => u.id === state.selectedUnitId)?.title || '';
        document.getElementById('ns-lesson-desc').textContent = "Complete the following modules to master this unit.";
        lessonSection.style.display = 'block';

        lessonItemsList.innerHTML = unitLessons.map(l => {
            let icon = '📄';
            if (l.type === 'video') icon = '▶️';
            if (l.type === 'activity') icon = '💻';
            return `
            <li class="ns-lesson-item ${state.selectedLessonId === l.id ? 'active' : ''} ${l.status === 'done' ? 'done' : ''}" onclick="state.selectedLessonId='${l.id}'; renderKALayout();">
                <div class="ns-lesson-icon">${icon}</div>
                <div class="ns-lesson-item-title">${l.title}</div>
                <div style="margin-left:auto; font-size:0.8rem; color:var(--ns-text-muted);">${l.duration}</div>
            </li>`;
        }).join('');

        // Viewer
        contentViewer.classList.remove('hidden');
        const activeLesson = unitLessons.find(l => l.id === state.selectedLessonId);
        if (activeLesson) {
            let innerHtml = '';
            if (activeLesson.type === 'video') {
                innerHtml = `
                    <div class="ns-video-player" style="background: url('${activeLesson.content}') center/cover;">
                        <div style="font-size:3rem;background:rgba(0,0,0,0.5);border-radius:50%;width:80px;height:80px;display:flex;align-items:center;justify-content:center;">▶</div>
                    </div>
                `;
            } else {
                innerHtml = `<div class="ns-reading-content">${activeLesson.content.replace(/\n/g, '<br>')}</div>`;
            }
            innerHtml += `<br><button class="ns-btn-primary" onclick="completeLesson()">${activeLesson.status === 'done' ? 'Completed' : 'Mark Complete'}</button>`;
            document.getElementById('ns-content-inner').innerHTML = innerHtml;
        }

        // Check Mastery
        const allDone = unitLessons.every(l => l.status === 'done');
        if (allDone) document.getElementById('ns-mastery-box').classList.remove('hidden');
        else document.getElementById('ns-mastery-box').classList.add('hidden');
    } else {
        lessonSection.style.display = 'none';
        contentViewer.classList.add('hidden');
        document.getElementById('ns-lesson-title').textContent = "No content available";
        document.getElementById('ns-lesson-desc').textContent = "Select another unit to proceed.";
        document.getElementById('ns-mastery-box').classList.add('hidden');
    }

    // Right Col: Practice
    const pracList = document.getElementById('ns-practice-container');
    if (pracList) {
        if (subj.practiceCards && subj.practiceCards.length > 0) {
            pracList.innerHTML = subj.practiceCards.map(p => `
                <div class="ns-practice-card">
                    <div class="ns-practice-status ${p.status}">${p.status.replace('-', ' ')}</div>
                    <h4 class="ns-practice-title">${p.title}</h4>
                    <button class="ns-btn-primary full-width" style="background:var(--ns-surface); color:var(--ns-primary); border:1px solid var(--ns-primary);">Practice</button>
                </div>
            `).join('');
        } else {
            pracList.innerHTML = '<p style="color:var(--ns-text-muted); font-size:0.9rem;">No practice items for this unit.</p>';
        }
    }
}

// Quiz Modal Logic
function bindQuizEvents() {
    const startBtn = document.getElementById('ns-start-quiz-btn');
    if (startBtn) startBtn.addEventListener('click', () => { state.quizCurrentQuestion = 1; state.quizScore = 0; renderQuizModal(); });

    document.getElementById('ns-quiz-next')?.addEventListener('click', () => {
        const feedback = document.getElementById('ns-quiz-feedback');
        if (document.getElementById('ns-quiz-next').textContent === 'Check Answer') {
            const selected = document.querySelector('input[name="ns-quiz-radio"]:checked');
            if (selected) {
                if (selected.value === '1') { feedback.textContent = 'Correct!'; feedback.className = 'ns-quiz-feedback correct'; state.quizScore++; }
                else { feedback.textContent = 'Incorrect. Review the lesson.'; feedback.className = 'ns-quiz-feedback incorrect'; }
                document.getElementById('ns-quiz-next').textContent = state.quizCurrentQuestion === 5 ? 'Finish' : 'Next Question';
            }
        } else {
            if (state.quizCurrentQuestion < 5) {
                state.quizCurrentQuestion++;
                renderQuizModal();
            } else {
                document.getElementById('ns-quiz-modal').classList.add('hidden');
                // update practice status to done
                const subj = state.subjects[state.selectedSubjectId];
                if (subj && subj.practiceCards[0]) subj.practiceCards[0].status = 'done';
                renderKALayout();
            }
        }
    });
}

function renderQuizModal() {
    document.getElementById('ns-quiz-modal').classList.remove('hidden');
    document.getElementById('ns-quiz-progress-text').textContent = `Question ${state.quizCurrentQuestion} of 5`;
    document.getElementById('ns-quiz-progress-fill').style.width = (state.quizCurrentQuestion * 20) + '%';

    document.getElementById('ns-quiz-body').innerHTML = `
        <h3>Sample mastery question #${state.quizCurrentQuestion}</h3>
        <div class="ns-quiz-options">
            <label class="ns-quiz-opt"><input type="radio" name="ns-quiz-radio" value="0"> Option A</label>
            <label class="ns-quiz-opt"><input type="radio" name="ns-quiz-radio" value="1"> Option B (Correct)</label>
            <label class="ns-quiz-opt"><input type="radio" name="ns-quiz-radio" value="0"> Option C</label>
        </div>
    `;
    document.getElementById('ns-quiz-feedback').textContent = '';
    document.getElementById('ns-quiz-next').textContent = 'Check Answer';
    document.getElementById('ns-quiz-next').disabled = true;

    document.querySelectorAll('.ns-quiz-opt').forEach(opt => {
        opt.addEventListener('click', (e) => {
            document.querySelectorAll('.ns-quiz-opt').forEach(o => o.style.background = '');
            e.currentTarget.style.background = 'var(--ns-bg)';
            e.currentTarget.querySelector('input').checked = true;
            document.getElementById('ns-quiz-next').disabled = false;
        });
    });
}

// Calendar CRUD Logic
// -------- Time helpers --------
function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // Sun=0
    const diff = (day === 0 ? -6 : 1) - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}
function fmtMonthYear(date) {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
function fmtDayNum(date) { return date.getDate(); }

function pad2(n) { return String(n).padStart(2, '0'); }
function minToHHMM(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${pad2(h)}:${pad2(m)}`;
}
function hhmmToMin(hhmm) {
    if (!hhmm || !hhmm.includes(':')) return null;
    const [h, m] = hhmm.split(':').map(x => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}
function minToLabel(min) {
    const h = Math.floor(min / 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = ((h + 11) % 12) + 1;
    return `${hh} ${ampm}`;
}

// -------- view state --------
state.calendarView = state.calendarView || {
    weekStart: startOfWeek(new Date())
};

function renderCalendar() {
    const container = document.getElementById('ns-calendar-container');
    if (!container) return;

    const weekStart = state.calendarView.weekStart;
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const dayStartMin = 6 * 60;   // 06:00
    const dayEndMin = 22 * 60;    // 22:00
    const PX_PER_HOUR = 120;

    const now = new Date();
    const isSameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    // hours for grid lines + labels
    const hours = [];
    for (let t = dayStartMin; t < dayEndMin; t += 60) hours.push(t);

    // Header (month + controls)
    const headerHtml = `
      <div class="cal-week__header">
        <h1 class="cal-week__title">${fmtMonthYear(weekStart)}</h1>
        <div class="cal-week__nav">
          <button class="cal-week__nav-btn" id="ns-cal2-prev" aria-label="Previous week">‹</button>
          <button class="cal-week__nav-btn cal-week__nav-btn--today" id="ns-cal2-today">Today</button>
          <button class="cal-week__nav-btn" id="ns-cal2-next" aria-label="Next week">›</button>
        </div>
      </div>
    `;

    // Day header row
    const dayHeaderHtml = `
      <div class="cal-week__days">
        <div class="cal-week__days-spacer"></div>
        ${days.map((d, idx) => {
        const label = d.toLocaleDateString(undefined, { weekday: 'short' }).substring(0, 3);
        const activeClass = isSameDay(d, now) ? 'cal-week__day-header--today' : '';
        const numActive = isSameDay(d, now) ? 'cal-week__day-num--today' : '';
        return `
              <div class="cal-week__day-header ${activeClass}">
                <span class="cal-week__day-name">${label}</span>
                <span class="cal-week__day-num ${numActive}">${fmtDayNum(d)}</span>
              </div>
            `;
    }).join('')}
      </div>
    `;

    // Grid with day columns
    const gridHtml = `
      <div class="cal-week__scroll">
        <div class="cal-grid" role="grid">
          <div class="cal-grid__hours">
            ${hours.map((t) => `
              <div class="cal-grid__hour-label" style="height:${PX_PER_HOUR}px">${minToLabel(t)}</div>
            `).join('')}
          </div>

          ${Array.from({ length: 7 }, (_, dayIdx) => {
        const isToday = isSameDay(days[dayIdx], now);

        const bgGrid = `
            <div class="cal-grid__bg">
            ${hours.map((h) => `
                <div class="cal-grid__slot" style="height:${PX_PER_HOUR}px" onclick="openCalModal(${dayIdx}, null, ${h})" role="button">
                <div class="cal-grid__slot-hover">+ Add Event</div>
                </div>
            `).join('')}
            </div>
        `;

        const eventsHtml = (state.calendarBlocks || [])
            .filter(e => Number(e.day) === dayIdx)
            .map(e => {
                const start = Math.max(e.startMin ?? dayStartMin, dayStartMin);
                const end = Math.min(e.endMin ?? (start + 60), dayEndMin);
                const top = ((start - dayStartMin) / 60) * PX_PER_HOUR;
                const minH = (e.kind === 'study') ? 72 : 24;
                const height = Math.max(minH, ((end - start) / 60) * PX_PER_HOUR - 2);

                const kind = e.kind || 'study';
                const missed = kind === 'missed';
                let bg = missed ? 'rgba(254,226,226,0.5)' : (kind === 'lecture' ? '#DBEAFE' : kind === 'tutorial' ? '#EDE9FE' : kind === 'lab' ? '#FEF9C3' : kind === 'user' ? '#F1F5F9' : kind === 'busy' ? '#E2E8F0' : '#DCFCE7');
                let bColor = missed ? '#EF4444' : (kind === 'lecture' ? '#3B82F6' : kind === 'tutorial' ? '#8B5CF6' : kind === 'lab' ? '#CA8A04' : kind === 'user' ? '#94A3B8' : kind === 'busy' ? '#64748B' : '#22C55E');
                let tColor = missed ? '#991B1B' : (kind === 'lecture' ? '#1E40AF' : kind === 'tutorial' ? '#5B21B6' : kind === 'lab' ? '#854D0E' : kind === 'user' ? '#475569' : kind === 'busy' ? '#334155' : '#166534');
                const badge = e.code || e.tag || kind.toUpperCase();

                if (e.tag) {
                    const tagInfo = (state.tags || []).find(t => t.name === e.tag);
                    if (tagInfo) {
                        bg = tagInfo.color + '25'; // e.g. 15% opacity hex roughly
                        bColor = tagInfo.color;
                        tColor = tagInfo.color;
                    }
                }

                return `
                    <div class="cal-block ${missed ? 'cal-block--missed' : ''} ${kind === 'busy' ? 'cal-block--busy' : ''}"
                        style="position:absolute; top:${top}px; left:2px; right:2px; height:${height}px; z-index:2; background:${bg}; border-left:3px solid ${bColor}; ${missed || kind === 'busy' ? 'border-style:dashed;' : ''} color:${tColor};"
                        onclick="openCalModal(${dayIdx}, '${e.id}'); event.stopPropagation();">
                    <div class="cal-block__header">
                        <span class="cal-block__time">${minToHHMM(start)} – ${minToHHMM(end)}</span>
                    </div>
                    <div class="cal-block__title" style="margin-top:${kind === 'busy' ? 4 : 0}px">${e.title || 'Untitled'}</div>
                    <div class="cal-block__tags" style="margin-top:4px;">
                        <span class="cal-block__badge" style="background:${bColor}18; color:${bColor}; border:1px solid ${bColor}40;">${missed ? 'MISSED' : badge}</span>
                    </div>
                    </div>
                `;
            }).join('');

        const nowIndicator = isToday ? (() => {
            const currentMin = now.getHours() * 60 + now.getMinutes();
            if (currentMin >= dayStartMin && currentMin <= dayEndMin) {
                const top = ((currentMin - dayStartMin) / 60) * PX_PER_HOUR;
                return `
                    <div class="cal-grid__now" style="top:${top}px">
                        <div class="cal-grid__now-dot"></div>
                        <div class="cal-grid__now-line"></div>
                    </div>
                `;
            }
            return '';
        })() : '';

        return `
            <div class="cal-grid__day-col" role="gridcell" aria-label="${days[dayIdx].toDateString()}">
            ${bgGrid}
            ${eventsHtml}
            ${nowIndicator}
            </div>
        `;
    }).join('')}
        </div>
      </div>
    `;

    // Legend
    const legendHtml = `
      <div class="cal-legend" role="region" aria-label="Calendar legend">
        <div class="cal-legend__item">
          <span class="cal-legend__swatch" style="background:#DBEAFE; border-left:3px solid #3B82F6;"></span>
          <span class="cal-legend__label">Lecture</span>
        </div>
        <div class="cal-legend__item">
          <span class="cal-legend__swatch" style="background:#EDE9FE; border-left:3px solid #8B5CF6;"></span>
          <span class="cal-legend__label">Tutorial</span>
        </div>
        <div class="cal-legend__item">
          <span class="cal-legend__swatch" style="background:#FEF9C3; border-left:3px solid #CA8A04;"></span>
          <span class="cal-legend__label">Lab</span>
        </div>
        <div class="cal-legend__item">
          <span class="cal-legend__swatch" style="background:#DCFCE7; border-left:3px solid #22C55E;"></span>
          <span class="cal-legend__label">Study Session</span>
        </div>
        <div class="cal-legend__item">
          <span class="cal-legend__swatch" style="background:#F1F5F9; border-left:3px solid #94A3B8; border-style:dashed;"></span>
          <span class="cal-legend__label">Busy</span>
        </div>
        <div class="cal-legend__item">
          <span class="cal-legend__swatch" style="background:#FEF2F2; border-left:3px solid #EF4444; border-style:dashed;"></span>
          <span class="cal-legend__label">Missed</span>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="cal-week">
        ${headerHtml}
        ${dayHeaderHtml}
        ${gridHtml}
        ${legendHtml}
      </div>
    `;

    // Controls bindings
    document.getElementById('ns-cal2-prev')?.addEventListener('click', () => {
        state.calendarView.weekStart = addDays(state.calendarView.weekStart, -7);
        renderCalendar();
    });
    document.getElementById('ns-cal2-next')?.addEventListener('click', () => {
        state.calendarView.weekStart = addDays(state.calendarView.weekStart, 7);
        renderCalendar();
    });
    document.getElementById('ns-cal2-today')?.addEventListener('click', () => {
        state.calendarView.weekStart = startOfWeek(new Date());
        renderCalendar();
    });
}

function renderTagDropdown() {
    const list = document.getElementById('ns-cal-tags-list');
    const search = document.getElementById('ns-cal-tags-search').value.toLowerCase();

    let html = '';
    const filtered = (state.tags || []).filter(t => t.name.toLowerCase().includes(search));

    filtered.forEach(tag => {
        html += `
            <li class="ns-tag-option" data-tag="${tag.name}" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:3px; background:${tag.color}"></span>
                ${tag.name}
            </li>
        `;
    });

    if (search.trim() && !filtered.find(t => t.name.toLowerCase() === search.trim())) {
        html += `
            <li class="ns-tag-option-create" data-tag="${search.trim()}" style="padding: 6px 12px; cursor: pointer; color: var(--ns-primary); display: flex; align-items: center; gap: 8px;">
                <span style="display:flex;align-items:center;justify-content:center; width:12px; height:12px; border-radius:3px; font-weight:bold; font-size:14px; margin-left:-2px;">+</span>
                Create "${search.trim()}"
            </li>
        `;
    }

    list.innerHTML = html;

    list.querySelectorAll('.ns-tag-option').forEach(el => {
        el.addEventListener('click', (e) => {
            selectModalTag(e.currentTarget.dataset.tag);
        });
    });

    list.querySelectorAll('.ns-tag-option-create').forEach(el => {
        el.addEventListener('click', (e) => {
            const newTagName = e.currentTarget.dataset.tag;
            const colors = ['#8B5A2B', '#4682B4', '#9370DB', '#2E8B57', '#eab308', '#ef4444', '#ec4899', '#f97316'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const newTag = { name: newTagName, color: randomColor, badgeColor: randomColor };
            if (!state.tags) state.tags = [];
            state.tags.push(newTag);
            selectModalTag(newTagName);
        });
    });
}

function selectModalTag(tagName) {
    state.currentEditTag = tagName;
    const tagInfo = (state.tags || []).find(t => t.name === tagName);
    const triggerSpan = document.getElementById('ns-cal-current-tag');
    if (tagInfo) {
        triggerSpan.innerHTML = `
            <span style="background:${tagInfo.color}33; color:${tagInfo.color}; padding: 2px 8px; border-radius: 4px; font-weight: 500; font-size: 0.85rem;">
                ${tagName}
            </span>
        `;
    } else {
        triggerSpan.textContent = "Empty";
    }
    document.getElementById('ns-cal-tags-dropdown').classList.add('hidden');
}

function bindCalendarEvents() {
    document.getElementById('ns-cal-add-btn')?.addEventListener('click', () => openCalModal(0));

    document.getElementById('ns-cal-cancel')?.addEventListener('click', () =>
        document.getElementById('ns-cal-modal').classList.add('hidden')
    );

    document.getElementById('ns-cal-modal-overlay')?.addEventListener('click', () =>
        document.getElementById('ns-cal-modal').classList.add('hidden')
    );

    const tagsTrigger = document.getElementById('ns-cal-tags-trigger');
    const tagsDropdown = document.getElementById('ns-cal-tags-dropdown');
    const tagsSearch = document.getElementById('ns-cal-tags-search');

    tagsTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        tagsDropdown.classList.toggle('hidden');
        if (!tagsDropdown.classList.contains('hidden')) {
            tagsSearch.value = '';
            renderTagDropdown();
            tagsSearch.focus();
        }
    });

    tagsSearch?.addEventListener('input', () => {
        renderTagDropdown();
    });

    tagsSearch?.addEventListener('click', (e) => e.stopPropagation());
    tagsDropdown?.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', () => {
        if (tagsDropdown && !tagsDropdown.classList.contains('hidden')) {
            tagsDropdown.classList.add('hidden');
        }
    });

    document.getElementById('ns-cal-save')?.addEventListener('click', () => {
        const modal = document.getElementById('ns-cal-modal');
        const editId = modal.dataset.editId || '';
        const id = editId || ('c' + Date.now());

        const title = document.getElementById('ns-cal-input-title').value.trim() || 'Untitled';
        const day = parseInt(document.getElementById('ns-cal-input-day').value, 10);

        let kind = 'user';
        if (state.currentEditTag) {
            kind = 'study';
        }

        const tag = state.currentEditTag || '';

        const startMin = hhmmToMin(document.getElementById('ns-cal-input-start').value);
        const endMin = hhmmToMin(document.getElementById('ns-cal-input-end').value);

        if (startMin == null || endMin == null || endMin <= startMin) {
            alert('Please set a valid start/end time (end must be after start).');
            return;
        }

        if (editId) {
            const block = state.calendarBlocks.find(b => b.id === id);
            if (block) {
                block.title = title;
                block.day = day;
                block.kind = kind;
                block.tag = tag;
                block.startMin = startMin;
                block.endMin = endMin;
            }
        } else {
            state.calendarBlocks.push({
                id,
                title,
                day,
                kind,
                tag,
                startMin,
                endMin
            });
        }

        modal.classList.add('hidden');
        renderCalendar();
    });

    document.getElementById('ns-cal-delete')?.addEventListener('click', () => {
        const modal = document.getElementById('ns-cal-modal');
        const id = modal.dataset.editId;
        if (!id) return;

        state.calendarBlocks = state.calendarBlocks.filter(b => b.id !== id);
        modal.classList.add('hidden');
        renderCalendar();
    });
}

function openCalModal(dayIdx, editId = null, startMinClicked = null, evt = null) {
    if (evt) evt.stopPropagation();
    const modal = document.getElementById('ns-cal-modal');
    modal.classList.remove('hidden');
    modal.dataset.editId = editId || '';

    const delBtn = document.getElementById('ns-cal-delete');

    const selectedDate = addDays(state.calendarView.weekStart, dayIdx);
    document.getElementById('ns-cal-text-date').textContent = selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('ns-cal-input-day').value = String(dayIdx);

    if (editId) {
        delBtn.classList.remove('hidden');

        const block = state.calendarBlocks.find(b => b.id === editId);
        if (!block) return;

        document.getElementById('ns-cal-input-title').value = block.title || '';
        document.getElementById('ns-cal-input-start').value = minToHHMM(block.startMin ?? 600);
        document.getElementById('ns-cal-input-end').value = minToHHMM(block.endMin ?? 660);

        selectModalTag(block.tag || block.code || null);
    } else {
        delBtn.classList.add('hidden');

        document.getElementById('ns-cal-input-title').value = '';

        const sm = startMinClicked ?? 600;
        document.getElementById('ns-cal-input-start').value = minToHHMM(sm);
        document.getElementById('ns-cal-input-end').value = minToHHMM(sm + 60);

        selectModalTag(null);
    }
}

/* =========================================================================
   BACKEND INTEGRATION — fetch live data from /integrated-weekly
   ========================================================================= */

async function fetchAndApplyBackendData() {
    // Topic mastery from bridge_data/topic_mastery.csv (stu_001, computer_security)
    const topicMastery = {
        memory_layout: 0.82,
        stack_frame: 0.74,
        buffer_overflow: 0.41,
        format_string_vulnerability: 0.56,
        integer_overflow: 0.47,
        authentication: 0.84,
        authorization_access_control: 0.61,
        reference_monitor: 0.35
    };

    const payload = {
        student_id: "stu_001",
        subject: "computer_security",
        days_until_exam: 14,
        current_weekly_minutes: 240,
        topic_mastery: topicMastery
    };

    try {
        const res = await fetch('http://localhost:8001/integrated-weekly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) { console.warn('Backend returned', res.status); return; }
        const data = await res.json();

        const pm = data.weekly_report.predicted_score_model;
        const baseScore = Math.round(pm.base_expected);
        const recScore = Math.round(pm.simulation_recommended_plan.expected_score);

        // 1. Dashboard stats cards
        const readinessEl = document.getElementById('ns-stat-readiness');
        if (readinessEl) readinessEl.innerHTML = `${baseScore}<span class="ns-stat-sub">/100</span>`;

        const predictedEl = document.getElementById('ns-stat-predicted');
        if (predictedEl) predictedEl.innerHTML = `${recScore}<span class="ns-stat-sub">%</span>`;

        const trendEl = document.getElementById('ns-stat-predicted-trend');
        if (trendEl) trendEl.textContent = `Projected: ${baseScore} → ${recScore}`;

        // Compute focus time from today's schedule
        let focusTimeStr = '--';
        if (data.todays_schedule && data.todays_schedule.total_study_minutes) {
            const mins = data.todays_schedule.total_study_minutes;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            focusTimeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        }
        const focusEl = document.getElementById('ns-stat-focus');
        if (focusEl) focusEl.textContent = focusTimeStr;

        // 2. Quick Insights (dashboard sidebar)
        const recs = data.weekly_report.prescriptive_analysis.recommendations.slice(0, 3);
        const insightsList = document.getElementById('ns-insights-list');
        if (insightsList && recs.length > 0) {
            insightsList.innerHTML = recs.map(r =>
                `<li><strong>${r.concept_name}:</strong> ${r.rationale}</li>`
            ).join('');
        }

        // 3. Populate courseAnalyticsData['1'] with real backend concepts
        if (data.concepts_payload && data.concepts_payload.length > 0) {
            courseAnalyticsData['1'].concepts = data.concepts_payload.map(c => ({
                id: c.id,
                name: c.name,
                exam_weightage: c.exam_weightage,
                mastery: c.mastery,
                last_practiced_at: c.last_practiced_at || null,
                prerequisites: c.prerequisites || [],
                difficulty: c.difficulty || 'medium',
            }));
            courseAnalyticsData['1'].focusTime = focusTimeStr;
        }

        // 4. Store backend prescriptive recommendations for the analytics Prescriptive Plan
        courseAnalyticsData['1'].backendRecommendations =
            data.weekly_report.prescriptive_analysis.recommendations || [];

        // 5. Store predicted score model for analytics view
        courseAnalyticsData['1'].predictedScoreModel = pm;

        // 6. Today's schedule → sidebar timeline
        if (data.todays_schedule && data.todays_schedule.blocks && data.todays_schedule.blocks.length > 0) {
            let cursor = 9 * 60; // start at 09:00
            state.todayPlan = data.todays_schedule.blocks.map((b, i) => {
                const start = minToHHMM(cursor);
                cursor += b.duration_minutes;
                const end = minToHHMM(cursor);
                cursor += 5; // 5-min break between blocks
                const conceptName = b.concept_ids[0]
                    ? b.concept_ids[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    : `Block ${i + 1}`;
                return {
                    id: `p${i + 1}`,
                    timeStart: start,
                    timeEnd: end,
                    subjectTitle: `SC3010: ${conceptName}`,
                    status: i === 0 ? 'active' : 'pending',
                    subjectId: `subj${(i % 3) + 1}`
                };
            });
            state.todayProgressPct = 0;
            renderStudySidebar();

            // 6b. Also add study blocks to the calendar on Sunday (day 6)
            // Remove any previously injected backend study blocks
            state.calendarBlocks = state.calendarBlocks.filter(b => !b.id.startsWith('backend_study_'));

            let calCursor = 9 * 60; // start at 09:00
            data.todays_schedule.blocks.forEach((b, i) => {
                const startMin = calCursor;
                calCursor += b.duration_minutes;
                const endMin = calCursor;
                const conceptName = b.concept_ids[0]
                    ? b.concept_ids[0].replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
                    : `Block ${i + 1}`;

                // Only add work/review blocks (skip short_break/long_break)
                if (b.block_type === 'work' || b.block_type === 'review') {
                    state.calendarBlocks.push({
                        id: `backend_study_${i}`,
                        title: `SC3010: ${conceptName}`,
                        day: 6, // Sunday
                        kind: 'study',
                        startMin,
                        endMin,
                        code: 'STUDY SESSION'
                    });
                }
            });
            renderCalendar();
        }

        // 7. Store top concepts for course mastery rings
        state.topConcepts = data.weekly_report.priority_ranking.top_concepts;
        renderNsAppCourses();

    } catch (e) {
        console.warn('Backend not reachable, using dummy data:', e);
    }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', init);

/* =========================================================================
   NORTHSTAR SPA LOGIC (For study.html)
   ========================================================================= */

function bindNsAppEvents() {
    // Sidebar Collapse
    const collapseBtn = document.getElementById('ns-sidebar-collapse');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            state.sidebarExpanded = !state.sidebarExpanded;
            const sidebar = document.getElementById('ns-sidebar');
            if (state.sidebarExpanded) {
                sidebar.classList.remove('collapsed');
                sidebar.classList.add('expanded');
                document.getElementById('ns-collapse-icon').innerHTML = '<polyline points="15 18 9 12 15 6"></polyline>';
            } else {
                sidebar.classList.add('collapsed');
                sidebar.classList.remove('expanded');
                document.getElementById('ns-collapse-icon').innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
            }
        });
    }

    // Tab Navigation
    document.querySelectorAll('#ns-nav-default .ns-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.dataset.target;
            if (targetId) {
                switchTab(targetId);

                // Update active state in sidebar
                document.querySelectorAll('#ns-nav-default .ns-nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Update page title
                document.getElementById('ns-page-title').textContent = item.querySelector('.ns-nav-label').textContent;
            }
        });
    });

    // Initialize initial calendar state events
    bindCalendarEvents();
    renderCalendar();
    bindQuizEvents();

    // Back button: return to My Courses
    const backBtn = document.getElementById('btn-back-courses');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            switchTab('view-courses');
            document.getElementById('ns-page-title').textContent = 'My Courses';
            document.querySelectorAll('#ns-nav-default .ns-nav-item').forEach((nav, i) => {
                nav.classList.toggle('active', i === 0);
            });
        });
    }

    // Drawer close
    const closeDrawer = document.getElementById('btn-close-drawer');
    if (closeDrawer) closeDrawer.addEventListener('click', closeConceptDrawer);
    const drawerOverlay = document.getElementById('ns-concept-drawer');
    if (drawerOverlay) drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) closeConceptDrawer();
    });
}

function switchTab(viewId) {
    state.activeTab = viewId;

    if (viewId === 'view-deepdive') {
        state.isStudyMode = true;
        renderKALayout();
    } else {
        if (state.isStudyMode) {
            state.isStudyMode = false;
        }
    }

    document.querySelectorAll('.ns-view').forEach(view => {
        if (view.id === viewId) {
            view.classList.add('active');
            // Retrigger animation
            view.style.animation = 'none';
            view.offsetHeight; // trigger reflow
            view.style.animation = null;
        } else {
            view.classList.remove('active');
        }
    });
}

function openCourseAnalytics(courseId) {
    state.activeCourseAnalyticsId = courseId;
    renderCourseAnalytics(courseId);
    switchTab('view-course-analytics');
    // update header title
    document.getElementById('ns-page-title').textContent = 'Course Analytics';
    // deactivate sidebar items
    document.querySelectorAll('#ns-nav-default .ns-nav-item').forEach(nav => nav.classList.remove('active'));
}



function renderNsAppCourses() {
    const grid = document.getElementById('ns-courses-grid');
    if (!grid) return;

    // Only pick the first 4 real courses to show in the mock dashboard
    const displayCourses = state.courses.slice(0, 4);

    const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899'];

    grid.innerHTML = displayCourses.map((c, idx) => {
        const analyticsPayload = courseAnalyticsData[c.id];
        const concepts = analyticsPayload ? analyticsPayload.concepts : [];
        const annotated = concepts.map(annotate);
        const weightedMastery = computeWeightedMastery(annotated);
        const masteryPct = Math.round(weightedMastery * 100);
        const attentionItems = annotated.filter(x => x.flags.requiresAttention);

        // Use real mastery from backend if available, else fallback
        const conceptMastery = state.topConcepts && state.topConcepts[idx]
            ? Math.round(state.topConcepts[idx].mastery * 100)
            : Math.floor(Math.random() * 40) + 40;
        const mastery = conceptMastery;

        const color = colors[idx % colors.length];
        const weakTopicNames = attentionItems.slice(0, 3).map(x => x.name).join(', ') || '—';
        return `
        <div class="ns-card ns-course-card" data-course-id="${c.id}" style="cursor:pointer;" onclick="openCourseAnalytics('${c.id}')">
            <div class="ns-course-header">
                <div>
                    <h3 class="ns-course-name">${c.code}</h3>
                    <p style="margin: 4px 0 0 0; color: var(--ns-text-muted); font-size: 0.9rem;">${c.title}</p>
                </div>
                <div class="ns-mastery-ring" style="--mastery: ${masteryPct}%; background: conic-gradient(${color} var(--mastery, 0%), var(--ns-sidebar-border) 0);">
                    <div class="ns-mastery-inner" style="color: ${color}">${masteryPct}%</div>
                </div>
            </div>
            <div class="ns-course-progress">
                <div class="ns-bar-label">
                    <span>Course Progress</span>
                    <span>${masteryPct}%</span>
                </div>
                <div class="ns-progress-bg">
                    <div class="ns-progress-fill" style="width: ${masteryPct}%; background: ${color}"></div>
                </div>
                <div class="ns-weak-topics">Requires Attention: ${weakTopicNames}</div>
            </div>
        </div>
        `;
    }).join('');
}

/* =========================================================
   COURSE ANALYTICS ENGINE
   Mirrors mastery_to_concepts_payload() from bridge.py
   ========================================================= */

/**
 * Mock bridge data keyed by course.id
 * Schema mirrors: mastery_to_concepts_payload(mastery_state, exam_weights, curriculum_meta)
 * { id, name, exam_weightage, mastery [0-1], last_practiced_at (ISO|null), prerequisites [id], difficulty }
 *
 * Replace `concepts` array below with a real fetch:
 *   const payload = await fetch('/api/course-report?course_id=' + courseId).then(r => r.json());
 */
const courseAnalyticsData = {
    '1': { // SC3010 — populated from backend
        name: 'Computer Security',
        code: 'SC3010',
        focusTime: '--',
        concepts: [],
        backendRecommendations: [],
    },
    '2': { // SC2002
        name: 'Object Oriented Design and Programming',
        code: 'SC2002',
        focusTime: '2h 45m',
        concepts: [
            { id: 's01', name: 'Classes & Objects', exam_weightage: 0.12, mastery: 0.90, last_practiced_at: '2026-03-01T09:00:00Z', prerequisites: [], difficulty: 'easy' },
            { id: 's02', name: 'Inheritance', exam_weightage: 0.15, mastery: 0.78, last_practiced_at: '2026-02-28T08:00:00Z', prerequisites: ['s01'], difficulty: 'medium' },
            { id: 's03', name: 'Polymorphism', exam_weightage: 0.18, mastery: 0.52, last_practiced_at: '2026-02-20T14:00:00Z', prerequisites: ['s01', 's02'], difficulty: 'medium' },
            { id: 's04', name: 'Interfaces & Abstract Classes', exam_weightage: 0.15, mastery: 0.35, last_practiced_at: null, prerequisites: ['s02'], difficulty: 'hard' },
            { id: 's05', name: 'Design Patterns', exam_weightage: 0.20, mastery: 0.28, last_practiced_at: null, prerequisites: ['s03', 's04'], difficulty: 'hard' },
            { id: 's06', name: 'Exception Handling', exam_weightage: 0.10, mastery: 0.70, last_practiced_at: '2026-02-26T11:00:00Z', prerequisites: ['s01'], difficulty: 'easy' },
            { id: 's07', name: 'Collections Framework', exam_weightage: 0.10, mastery: 0.60, last_practiced_at: '2026-02-23T10:00:00Z', prerequisites: ['s01'], difficulty: 'medium' },
        ]
    },
    '3': { // SC2006
        name: 'Software Engineering',
        code: 'SC2006',
        focusTime: '4h 10m',
        concepts: [
            { id: 'e01', name: 'SDLC Models', exam_weightage: 0.12, mastery: 0.88, last_practiced_at: '2026-03-01T10:00:00Z', prerequisites: [], difficulty: 'easy' },
            { id: 'e02', name: 'Requirements Engineering', exam_weightage: 0.15, mastery: 0.75, last_practiced_at: '2026-02-28T13:00:00Z', prerequisites: ['e01'], difficulty: 'medium' },
            { id: 'e03', name: 'UML Diagrams', exam_weightage: 0.18, mastery: 0.82, last_practiced_at: '2026-02-27T09:00:00Z', prerequisites: ['e02'], difficulty: 'medium' },
            { id: 'e04', name: 'Design Patterns', exam_weightage: 0.20, mastery: 0.58, last_practiced_at: '2026-02-22T14:00:00Z', prerequisites: ['e03'], difficulty: 'hard' },
            { id: 'e05', name: 'Testing & QA', exam_weightage: 0.15, mastery: 0.40, last_practiced_at: '2026-02-18T08:00:00Z', prerequisites: ['e04'], difficulty: 'hard' },
            { id: 'e06', name: 'Agile Methodologies', exam_weightage: 0.10, mastery: 0.72, last_practiced_at: '2026-03-01T11:00:00Z', prerequisites: [], difficulty: 'easy' },
            { id: 'e07', name: 'DevOps & CI/CD', exam_weightage: 0.10, mastery: 0.22, last_practiced_at: null, prerequisites: ['e05'], difficulty: 'hard' },
        ]
    },
    '4': { // MH1810
        name: 'Mathematics I',
        code: 'MH1810',
        focusTime: '5h 30m',
        concepts: [
            { id: 'm01', name: 'Limits & Continuity', exam_weightage: 0.12, mastery: 0.92, last_practiced_at: '2026-03-01T08:00:00Z', prerequisites: [], difficulty: 'easy' },
            { id: 'm02', name: 'Differentiation', exam_weightage: 0.18, mastery: 0.85, last_practiced_at: '2026-02-28T09:00:00Z', prerequisites: ['m01'], difficulty: 'medium' },
            { id: 'm03', name: 'Integration Techniques', exam_weightage: 0.20, mastery: 0.65, last_practiced_at: '2026-02-26T14:00:00Z', prerequisites: ['m02'], difficulty: 'hard' },
            { id: 'm04', name: 'Differential Equations', exam_weightage: 0.20, mastery: 0.38, last_practiced_at: '2026-02-20T10:00:00Z', prerequisites: ['m02', 'm03'], difficulty: 'hard' },
            { id: 'm05', name: 'Sequences & Series', exam_weightage: 0.15, mastery: 0.55, last_practiced_at: '2026-02-24T11:00:00Z', prerequisites: ['m01'], difficulty: 'medium' },
            { id: 'm06', name: 'Linear Algebra', exam_weightage: 0.15, mastery: 0.30, last_practiced_at: null, prerequisites: [], difficulty: 'hard' },
        ]
    }
};

/* -------- Derived analytics helpers -------- */

/**
 * annotate() — adds computed flags to a concept object
 * Mirrors the rules defined in bridge.py / insights.py
 */
function annotate(c) {
    const now = new Date();
    const lastPrac = c.last_practiced_at ? new Date(c.last_practiced_at) : null;
    const daysSince = lastPrac ? (now - lastPrac) / (1000 * 60 * 60 * 24) : Infinity;

    const flags = {
        notStarted: !lastPrac && c.mastery <= 0.2,
        weak: c.mastery < 0.6,
        strong: c.mastery >= 0.8,
        highWeight: c.exam_weightage >= 0.15,
        dueReview: daysSince > 7 && c.mastery < 0.8 && lastPrac !== null,
        blocked: false // resolved below after full annotated list
    };

    flags.requiresAttention = (flags.highWeight && flags.weak) || flags.notStarted || flags.dueReview;
    return { ...c, flags, daysSince };
}

/** Resolve blocked flag (prereq mastery < 0.6) — requires full map */
function resolveBlocked(annotatedList) {
    const masteryMap = Object.fromEntries(annotatedList.map(c => [c.id, c.mastery]));
    return annotatedList.map(c => {
        const blocked = (c.prerequisites || []).some(pid => (masteryMap[pid] ?? 1) < 0.6);
        const requiresAttention = c.flags.requiresAttention || blocked;
        return { ...c, flags: { ...c.flags, blocked, requiresAttention } };
    });
}

function computeWeightedMastery(annotatedList) {
    const totalWeight = annotatedList.reduce((s, c) => s + c.exam_weightage, 0);
    if (totalWeight === 0) return 0.5;
    return annotatedList.reduce((s, c) => s + c.mastery * c.exam_weightage, 0) / totalWeight;
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

/** Friendly relative time */
function relativeTime(isoStr) {
    if (!isoStr) return 'Never';
    const diff = (Date.now() - new Date(isoStr)) / (1000 * 60 * 60 * 24);
    if (diff < 1) return 'Today';
    if (diff < 2) return 'Yesterday';
    return `${Math.floor(diff)}d ago`;
}

/** Reason chips for an attention item */
function reasonChips(c) {
    const chips = [];
    if (c.flags.notStarted) chips.push('<span class="ns-badge ns-badge-neutral">Not started</span>');
    if (c.flags.weak) chips.push('<span class="ns-badge ns-badge-danger">Low mastery</span>');
    if (c.flags.highWeight) chips.push('<span class="ns-badge ns-badge-warning">High weight</span>');
    if (c.flags.dueReview) chips.push('<span class="ns-badge ns-badge-info">Due review</span>');
    if (c.flags.blocked) chips.push('<span class="ns-badge ns-badge-danger">Blocked by prereq</span>');
    return chips.join('');
}

/** Status badge */
function statusBadge(c) {
    if (c.flags.strong) return '<span class="ns-badge ns-badge-success">Strong</span>';
    if (c.flags.blocked) return '<span class="ns-badge ns-badge-danger">Blocked</span>';
    if (c.flags.notStarted) return '<span class="ns-badge ns-badge-neutral">Not Started</span>';
    if (c.flags.dueReview) return '<span class="ns-badge ns-badge-info">Review</span>';
    if (c.flags.weak) return '<span class="ns-badge ns-badge-warning">Weak</span>';
    return '<span class="ns-badge ns-badge-success">On Track</span>';
}

/** Difficulty badge */
function difficultyBadge(diff) {
    const map = {
        easy: '<span class="ns-diff-dot ns-diff-easy"></span>Easy',
        medium: '<span class="ns-diff-dot ns-diff-medium"></span>Medium',
        hard: '<span class="ns-diff-dot ns-diff-hard"></span>Hard',
    };
    return `<span style="display:inline-flex;align-items:center;">${map[diff] || diff}</span>`;
}

/** Mastery progress cell */
function masteryCell(mastery) {
    const pct = Math.round(mastery * 100);
    const color = pct >= 80 ? 'var(--ns-success)' : pct >= 60 ? 'var(--ns-warning)' : 'var(--ns-danger)';
    return `<div class="ns-mastery-cell">
        <div class="ns-progress-bar-bg" style="flex:1; height:6px;">
            <div class="ns-progress-bar-fill" style="width:${pct}%; background:${color};"></div>
        </div>
        <span style="font-weight:700; font-size:0.9rem; color:${color}; min-width:36px; text-align:right;">${pct}%</span>
    </div>`;
}

/* -------- Main renderer -------- */

function renderCourseAnalytics(courseId) {
    const payload = courseAnalyticsData[courseId];
    if (!payload) return;

    const course = state.courses.find(c => c.id === courseId);
    if (!course) return;

    // 1. Header
    document.getElementById('ns-analytics-course-code').textContent = payload.code || course.code;
    document.getElementById('ns-analytics-course-title').textContent = payload.name || course.title;

    // 2. Annotate concepts
    let annotated = payload.concepts.map(annotate);
    annotated = resolveBlocked(annotated);
    state.analyticsAnnotated = annotated; // cache for drawer lookups

    // 3. Compute KPIs — use backend predicted score model if available
    let readiness, predicted;
    if (payload.predictedScoreModel) {
        readiness = Math.round(payload.predictedScoreModel.base_expected);
        predicted = Math.round(payload.predictedScoreModel.simulation_recommended_plan.expected_score);
    } else {
        const weightedMastery = computeWeightedMastery(annotated);
        readiness = Math.round(weightedMastery * 100);
        predicted = Math.round(clamp(50 + weightedMastery * 50, 0, 100));
    }
    const attentionCount = annotated.filter(c => c.flags.requiresAttention).length;
    const focusTime = payload.focusTime || '\u2014';

    document.getElementById('ns-analytics-readiness').innerHTML = `${readiness}<span class="ns-stat-sub">/100</span>`;
    document.getElementById('ns-analytics-readiness-trend').textContent = readiness >= 75 ? '\u2191 On track' : 'Needs improvement';
    document.getElementById('ns-analytics-readiness-trend').className = `ns-stat-trend ${readiness >= 75 ? 'positive' : 'negative'}`;
    document.getElementById('ns-analytics-predicted').innerHTML = `${predicted}<span class="ns-stat-sub">%</span>`;
    document.getElementById('ns-analytics-predicted-trend').textContent = payload.predictedScoreModel
        ? `Based on current mastery trend`
        : `Based on current mastery trend`;
    document.getElementById('ns-analytics-focus').textContent = focusTime;
    document.getElementById('ns-analytics-attention-count').textContent = attentionCount;

    // 4. Render attention list
    renderAttentionList(annotated);

    // 5. Render table (default: sorted by mastery asc)
    state.analyticsFilter = 'all';
    state.analyticsSort = 'mastery-asc';
    renderConceptTableFilters(annotated);
    renderConceptTable(annotated);

    // 6. Quick Insights
    renderQuickInsights(annotated);
}

function renderAttentionList(annotated) {
    const list = document.getElementById('ns-analytics-attention-list');
    if (!list) return;
    const attentionItems = annotated.filter(c => c.flags.requiresAttention).slice(0, 3);
    if (attentionItems.length === 0) {
        list.innerHTML = '<p style="color: var(--ns-text-muted); font-size:0.9rem;">\u2728 No flagged concepts \u2014 you\'re on top of things!</p>';
        return;
    }
    list.innerHTML = attentionItems.map(c => `
        <div class="ns-attention-item">
            <div class="ns-attention-info">
                <h4>${c.name}</h4>
                <p>Mastery: ${Math.round(c.mastery * 100)}% &bull; Weight: ${Math.round(c.exam_weightage * 100)}%</p>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${reasonChips(c)}</div>
            </div>
            <button class="ns-btn-primary" style="flex-shrink:0; margin-left:16px;"
                onclick="openConceptDrawer('${c.id}')">Start Practice</button>
        </div>
    `).join('');
}

function renderConceptTableFilters(annotated) {
    const filters = document.getElementById('ns-analytics-filters');
    if (!filters) return;

    const options = [
        { key: 'all', label: 'All' },
        { key: 'weak', label: 'Weak' },
        { key: 'highWeight', label: 'High Weight' },
        { key: 'notStarted', label: 'Not Started' },
        { key: 'blocked', label: 'Blocked' },
        { key: 'dueReview', label: 'Due Review' },
    ];

    filters.innerHTML = options.map(opt => `
        <button class="ns-badge ${state.analyticsFilter === opt.key ? 'ns-badge-info' : 'ns-badge-neutral'}"
            style="cursor:pointer; padding:6px 14px; border:none;"
            onclick="setAnalyticsFilter('${opt.key}')">${opt.label}</button>
    `).join('');
}

function setAnalyticsFilter(key) {
    state.analyticsFilter = key;
    const payload = courseAnalyticsData[state.activeCourseAnalyticsId];
    if (!payload) return;
    let annotated = payload.concepts.map(annotate);
    annotated = resolveBlocked(annotated);
    state.analyticsAnnotated = annotated;
    renderConceptTableFilters(annotated);
    renderConceptTable(annotated);
}

/** Prescriptive action type per concept */
function conceptAction(c) {
    if (c.flags.notStarted) return { type: 'learn', time: 90 };
    if (c.flags.blocked) return { type: 'unblock', time: 60 };
    if (c.flags.dueReview) return { type: 'revise', time: 45 };
    if (c.flags.weak) return { type: 'reinforce', time: 60 };
    return { type: 'maintain', time: 25 };
}

/** Why text per flag combo */
function conceptWhy(c) {
    if (c.flags.notStarted) return `You haven't started this yet. With ${Math.round(c.exam_weightage * 100)}% exam weight, beginning now will have a high score impact.`;
    if (c.flags.blocked) return `Prerequisite concepts have low mastery (<60%). Strengthen foundations first to unlock solid understanding here.`;
    if (c.flags.dueReview) return `High forgetting risk — it's been ${Math.floor(c.daysSince)}d since last practice. Quick revision now stabilizes memory retention.`;
    if (c.flags.weak && c.flags.highWeight) return `Low mastery (${Math.round(c.mastery * 100)}%) on a high-weight (${Math.round(c.exam_weightage * 100)}%) concept — prime target for score improvement.`;
    if (c.flags.weak) return `Mastery at ${Math.round(c.mastery * 100)}% — below the 60% threshold. Focused practice will consolidate understanding.`;
    return `You're doing well here (${Math.round(c.mastery * 100)}%). A short revision session will lock in your mastery before the exam.`;
}

/** Next steps bullets per action type */
function conceptNextSteps(c, action) {
    const steps = {
        learn: [
            'Read the core concept notes / lecture slides (20–30 min)',
            'Watch a short explainer video or worked example',
            'Attempt 3–5 starter practice questions',
            'Create a concept map or summary sheet',
        ],
        unblock: [
            `First revise: ${(c.prerequisites || []).join(', ') || 'prerequisite topics'} to ≥60% mastery`,
            'Then revisit this concept with that foundation in place',
            'Do active recall: solve questions without looking at notes',
        ],
        revise: [
            'Review notes for 15 min — focus on key definitions',
            'Do 3–5 quick recall questions from memory',
            'Create 10 flashcards / cues for spaced repetition',
        ],
        reinforce: [
            'Attempt past exam questions on this concept',
            'Identify which sub-topics you consistently get wrong',
            'Keep an error log and reattempt after 24 hours',
        ],
        maintain: [
            'Quick 10-min review once a week to avoid decay',
            'Test yourself with 2–3 application-level questions',
        ],
    };
    return steps[action.type] || steps.revise;
}

function renderConceptTable(annotated) {
    const container = document.getElementById('ns-analytics-table-body');
    if (!container) return;

    // Check if backend recommendations are available for courseId '1'
    const payload = courseAnalyticsData[state.activeCourseAnalyticsId];
    const backendRecs = (payload && payload.backendRecommendations && payload.backendRecommendations.length > 0)
        ? payload.backendRecommendations
        : null;

    // Build a lookup map from backend recs (concept_id -> recommendation)
    const recsMap = {};
    if (backendRecs) {
        backendRecs.forEach(r => { recsMap[r.concept_id] = r; });
    }

    // Apply filter
    let filtered = annotated;
    const f = state.analyticsFilter || 'all';
    if (f !== 'all') filtered = annotated.filter(c => c.flags[f]);

    // Sort by mastery ascending (weakest first — most actionable)
    filtered = [...filtered].sort((a, b) => a.mastery - b.mastery);

    if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:24px; text-align:center; color:var(--ns-text-muted);">No concepts match this filter.</div>`;
        return;
    }

    container.innerHTML = filtered.map(c => {
        // Use backend recommendation if available, else compute locally
        const backendRec = recsMap[c.id];
        let actionLabel, time, why, steps;

        if (backendRec) {
            actionLabel = backendRec.action_type.charAt(0).toUpperCase() + backendRec.action_type.slice(1);
            time = backendRec.minutes;
            why = backendRec.rationale;
            steps = backendRec.next_steps || [];
        } else {
            const act = conceptAction(c);
            actionLabel = { learn: 'Learn', revise: 'Revise', reinforce: 'Reinforce', unblock: 'Unblock', maintain: 'Maintain' }[act.type] || act.type;
            time = act.time;
            why = conceptWhy(c);
            steps = conceptNextSteps(c, act);
        }

        const pct = Math.round(c.mastery * 100);
        const color = pct >= 80 ? 'var(--ns-success)' : pct >= 60 ? 'var(--ns-warning)' : 'var(--ns-danger)';

        return `
        <div class="ns-prescriptive-card" onclick="openConceptDrawer('${c.id}')">
            <div class="ns-presc-header">
                <div>
                    <div class="ns-presc-title">${c.name}</div>
                    <div class="ns-presc-action-type">${actionLabel}</div>
                </div>
                <div class="ns-presc-meta">
                    <span class="ns-presc-time">${time} min</span>
                    <div class="ns-presc-mastery-row">
                        <div style="width:80px; height:5px; background:var(--ns-sidebar-border); border-radius:4px; overflow:hidden; display:inline-block; vertical-align:middle;">
                            <div style="width:${pct}%; height:100%; background:${color};"></div>
                        </div>
                        <span style="font-size:0.8rem; color:${color}; font-weight:700; margin-left:6px;">${pct}%</span>
                    </div>
                </div>
            </div>
            <p class="ns-presc-why"><strong>Why:</strong> ${why}</p>
            <div class="ns-presc-steps">
                <p class="ns-presc-steps-label">Next steps:</p>
                <ul>${steps.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>
        </div>
        `;
    }).join('');
}

function renderQuickInsights(annotated) {
    const list = document.getElementById('ns-analytics-insights-list');
    if (!list) return;

    const sorted = [...annotated].sort((a, b) => a.mastery - b.mastery);
    const weakest = sorted[0];
    const strongest = [...annotated].sort((a, b) => b.mastery - a.mastery)[0];
    const notStarted = annotated.filter(c => c.flags.notStarted).length;
    const highImpact = annotated.filter(c => c.flags.highWeight && c.flags.weak);

    const insights = [
        weakest ? `<strong>Focus on:</strong> ${weakest.name} (${Math.round(weakest.mastery * 100)}% mastery, ${Math.round(weakest.exam_weightage * 100)}% weight)` : null,
        strongest ? `<strong>Strength:</strong> ${strongest.name} \u2014 ${Math.round(strongest.mastery * 100)}% mastery, keep it up!` : null,
        notStarted > 0 ? `<strong>${notStarted} concept${notStarted > 1 ? 's' : ''}</strong> not yet started \u2014 tackle these before the exam.` : null,
        highImpact.length > 0 ? `<strong>${highImpact.length} high-weight, weak</strong> concept${highImpact.length > 1 ? 's' : ''} need urgent attention.` : null,
    ].filter(Boolean);

    list.innerHTML = insights.map(t => `<li>${t}</li>`).join('');
}

/* -------- Concept Drawer -------- */

function openConceptDrawer(conceptId) {
    const all = state.analyticsAnnotated || [];
    const c = all.find(x => x.id === conceptId);
    if (!c) return;

    document.getElementById('ns-drawer-title').textContent = c.name;
    document.getElementById('ns-drawer-mastery-fill').style.width = Math.round(c.mastery * 100) + '%';
    document.getElementById('ns-drawer-mastery-text').textContent = Math.round(c.mastery * 100) + '%';
    document.getElementById('ns-drawer-weight').textContent = Math.round(c.exam_weightage * 100) + '%';

    // Badges
    document.getElementById('ns-drawer-badges').innerHTML = [
        difficultyBadge(c.difficulty),
        statusBadge(c)
    ].join('');

    // Prerequisites
    const prereqList = document.getElementById('ns-drawer-prereqs');
    const masteryMap = Object.fromEntries(all.map(x => [x.id, x]));
    if (c.prerequisites && c.prerequisites.length > 0) {
        prereqList.innerHTML = c.prerequisites.map(pid => {
            const prereq = masteryMap[pid];
            if (!prereq) return '';
            const pct = Math.round(prereq.mastery * 100);
            const color = pct >= 60 ? 'var(--ns-success)' : 'var(--ns-danger)';
            return `<li class="ns-prereq-item">
                <span>${prereq.name}</span>
                <span style="font-weight:700; color:${color};">${pct}%</span>
            </li>`;
        }).filter(Boolean).join('');
    } else {
        prereqList.innerHTML = '<li class="ns-prereq-item" style="color:var(--ns-text-muted);">No prerequisites</li>';
    }

    // Recommendation text
    const rec = document.getElementById('ns-drawer-recommendation');
    let why = '';
    if (c.flags.notStarted) why = `You haven't started "${c.name}" yet. With ${Math.round(c.exam_weightage * 100)}% exam weight, starting now will have a high score impact.`;
    else if (c.flags.blocked) why = `Some prerequisites for "${c.name}" have low mastery. Strengthen those first to unlock solid understanding.`;
    else if (c.flags.dueReview) why = `It's been ${Math.floor(c.daysSince)} days since you last practiced "${c.name}". Spaced repetition now will lock in your memory.`;
    else if (c.flags.weak) why = `"${c.name}" is below 60% mastery with ${Math.round(c.exam_weightage * 100)}% exam weight — prime target for a quick mark gain.`;
    else why = `"${c.name}" looks good! A quick review session will lock in your strong mastery before the exam.`;
    rec.textContent = why;

    // Bind CTA
    document.getElementById('btn-drawer-practice').onclick = () => {
        closeConceptDrawer();
        // Future hook: navigate to practice session
        // window.location.href = `/practice?course_id=${state.activeCourseAnalyticsId}&concept_id=${c.id}`;
    };

    document.getElementById('ns-concept-drawer').classList.remove('hidden');
}

function closeConceptDrawer() {
    document.getElementById('ns-concept-drawer').classList.add('hidden');
}
