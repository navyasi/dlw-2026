const initialCourses = [
    {
        id: '1',
        code: 'CZ1003',
        title: 'Introduction to Computational Thinking',
        term: '2025-s2',
        favourite: true,
        instructors: ['Luiz Fernando', 'Smith John'],
        image: 'https://picsum.photos/seed/cz1003/600/300'
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
        { id: 'p1', timeStart: '09:00', timeEnd: '09:45', subjectTitle: 'Non-contact interactions', status: 'active', subjectId: 'subj1' },
        { id: 'p2', timeStart: '10:00', timeEnd: '10:50', subjectTitle: 'Calculus: Optimization', status: 'pending', subjectId: 'subj2' },
        { id: 'p3', timeStart: '13:00', timeEnd: '14:30', subjectTitle: 'Data Structures: Graphs', status: 'pending', subjectId: 'subj3' }
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

    // --- TIMEMAP / CALENDAR STATE ---
    calendarBlocks: [
        { id: 'c1', title: 'Machine Learning Lec', day: 0, type: 'task' },
        { id: 'c2', title: 'Deep Work (AI Suggested)', day: 1, type: 'focus' },
        { id: 'c3', title: 'Assignment Due', day: 4, type: 'due' },
        { id: 'c4', title: 'Review Graphs', day: 3, type: 'task' }
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
        // We still need to bind the North Star deep dive specific events
        bindNorthStarEvents();

        playCinematicReveal();
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
        timelineEl.innerHTML = state.todayPlan.map(plan => `
            <li class="ns-timeline-item ${plan.status === 'active' ? 'active' : ''} ${plan.status === 'done' ? 'done' : ''}" onclick="selectPlanSubject('${plan.subjectId}', '${plan.id}')">
                <div class="ns-timeline-dot"></div>
                <div class="ns-timeline-time">${plan.timeStart} - ${plan.timeEnd}</div>
                <div class="ns-timeline-title">${plan.subjectTitle}</div>
            </li>
        `).join('');
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
function renderCalendar() {
    const container = document.getElementById('ns-calendar-container');
    if (!container) return;

    let html = '<div class="ns-tm-grid">';
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    days.forEach(d => html += `<div class="ns-tm-day">${d}</div>`);

    for (let d = 0; d < 7; d++) {
        html += `<div class="ns-tm-col" onclick="openCalModal(${d})">`;
        const blocks = state.calendarBlocks.filter(b => parseInt(b.day) === d);
        blocks.forEach(b => {
            html += `<div class="ns-tm-slot bg-${b.type}" onclick="event.stopPropagation(); openCalModal(${d}, '${b.id}')">${b.title}</div>`;
        });
        html += `</div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

function bindCalendarEvents() {
    document.getElementById('ns-cal-add-btn')?.addEventListener('click', () => openCalModal(0));
    document.getElementById('ns-cal-cancel')?.addEventListener('click', () => document.getElementById('ns-cal-modal').classList.add('hidden'));
    document.getElementById('ns-cal-modal-overlay')?.addEventListener('click', () => document.getElementById('ns-cal-modal').classList.add('hidden'));

    document.getElementById('ns-cal-save')?.addEventListener('click', () => {
        const id = document.getElementById('ns-cal-modal').dataset.editId || 'c' + Date.now();
        const title = document.getElementById('ns-cal-input-title').value;
        const day = document.getElementById('ns-cal-input-day').value;
        const type = document.getElementById('ns-cal-input-type').value;

        if (title.trim() === '') return;

        if (document.getElementById('ns-cal-modal').dataset.editId) {
            const block = state.calendarBlocks.find(b => b.id === id);
            if (block) { block.title = title; block.day = day; block.type = type; }
        } else {
            state.calendarBlocks.push({ id, title, day, type });
        }

        document.getElementById('ns-cal-modal').classList.add('hidden');
        renderCalendar();
    });

    document.getElementById('ns-cal-delete')?.addEventListener('click', () => {
        const id = document.getElementById('ns-cal-modal').dataset.editId;
        if (id) {
            state.calendarBlocks = state.calendarBlocks.filter(b => b.id !== id);
            document.getElementById('ns-cal-modal').classList.add('hidden');
            renderCalendar();
        }
    });
}

function openCalModal(dayIdx, editId = null) {
    const modal = document.getElementById('ns-cal-modal');
    modal.classList.remove('hidden');
    modal.dataset.editId = editId || '';

    if (editId) {
        document.getElementById('ns-cal-modal-title').textContent = 'Edit Block';
        document.getElementById('ns-cal-delete').classList.remove('hidden');
        const block = state.calendarBlocks.find(b => b.id === editId);
        if (block) {
            document.getElementById('ns-cal-input-title').value = block.title;
            document.getElementById('ns-cal-input-day').value = block.day;
            document.getElementById('ns-cal-input-type').value = block.type;
        }
    } else {
        document.getElementById('ns-cal-modal-title').textContent = 'Add Block';
        document.getElementById('ns-cal-delete').classList.add('hidden');
        document.getElementById('ns-cal-input-title').value = '';
        document.getElementById('ns-cal-input-day').value = dayIdx;
        document.getElementById('ns-cal-input-type').value = 'task';
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



function renderNsAppCourses() {
    const grid = document.getElementById('ns-courses-grid');
    if (!grid) return;

    // Only pick the first 4 real courses to show in the mock dashboard
    const displayCourses = state.courses.slice(0, 4);

    const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899'];

    grid.innerHTML = displayCourses.map((c, idx) => {
        const mastery = Math.floor(Math.random() * 40) + 40; // 40-80%
        const color = colors[idx % colors.length];
        return `
        <div class="ns-card ns-course-card">
            <div class="ns-course-header">
                <div>
                    <h3 class="ns-course-name">${c.code}</h3>
                    <p style="margin: 4px 0 0 0; color: var(--ns-text-muted); font-size: 0.9rem;">${c.title}</p>
                </div>
                <div class="ns-mastery-ring" style="--mastery: ${mastery}%; background: conic-gradient(${color} var(--mastery, 0%), var(--ns-sidebar-border) 0);">
                    <div class="ns-mastery-inner" style="color: ${color}">${mastery}%</div>
                </div>
            </div>
            <div class="ns-course-progress">
                <div class="ns-bar-label">
                    <span>Course Progress</span>
                    <span>${mastery}%</span>
                </div>
                <div class="ns-progress-bg">
                    <div class="ns-progress-fill" style="width: ${mastery}%; background: ${color}"></div>
                </div>
                <div class="ns-weak-topics">Requires Attention: Arrays, Pointers</div>
            </div>
        </div>
        `;
    }).join('');
}
