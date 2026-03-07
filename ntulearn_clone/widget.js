document.addEventListener("DOMContentLoaded", () => {
    const WIDGETS = [
        {
            id: "widget-greeting",
            title: "Greeting",
            html: `
                <div class="ns-card ns-greeting-card ns-widget" id="widget-greeting">
                    <button class="ns-widget-remove" data-id="widget-greeting" title="Remove widget">&times;</button>
                    <h3>Good evening, Sarah</h3>
                    <p>You're on track for your weekly goal.</p>
                </div>
            `,
            target: ".ns-dashboard-top"
        },
        {
            id: "widget-readiness",
            title: "Readiness Score",
            html: `
                <div class="ns-card ns-stat-card ns-widget" id="widget-readiness">
                    <button class="ns-widget-remove" data-id="widget-readiness" title="Remove widget">&times;</button>
                    <div class="ns-stat-title">Readiness Score</div>
                    <div class="ns-stat-value" id="ns-stat-readiness">92<span class="ns-stat-sub">/100</span></div>
                    <div class="ns-stat-trend positive" id="ns-stat-readiness-trend">↑ 4 pts this week</div>
                </div>
            `,
            target: ".ns-dashboard-top"
        },
        {
            id: "widget-predicted",
            title: "Predicted Score",
            html: `
                <div class="ns-card ns-stat-card ns-widget" id="widget-predicted">
                    <button class="ns-widget-remove" data-id="widget-predicted" title="Remove widget">&times;</button>
                    <div class="ns-stat-title">Predicted Score</div>
                    <div class="ns-stat-value" id="ns-stat-predicted">88<span class="ns-stat-sub">%</span></div>
                    <div class="ns-stat-trend" id="ns-stat-predicted-trend">Projected: 82 → 88</div>
                </div>
            `,
            target: ".ns-dashboard-top"
        },
        {
            id: "widget-focus",
            title: "Focus Time",
            html: `
                <div class="ns-card ns-stat-card ns-widget" id="widget-focus">
                    <button class="ns-widget-remove" data-id="widget-focus" title="Remove widget">&times;</button>
                    <div class="ns-stat-title">Focus Time</div>
                    <div class="ns-stat-value" id="ns-stat-focus">4h 20m</div>
                    <div class="ns-stat-trend">This week</div>
                </div>
            `,
            target: ".ns-dashboard-top"
        },
        {
            id: "widget-practice",
            title: "Precision Practice",
            html: `
                <div class="ns-card ns-action-card ns-widget" id="widget-practice">
                    <button class="ns-widget-remove" data-id="widget-practice" title="Remove widget">&times;</button>
                    <h3>Precision Practice</h3>
                    <p>Target your weakest areas across all courses.</p>
                    <button class="ns-btn-primary full-width">Start Session</button>
                </div>
            `,
            target: ".ns-courses-sidebar"
        },
        {
            id: "widget-insights",
            title: "Quick Insights",
            html: `
                <div class="ns-card ns-insights-card ns-widget" id="widget-insights">
                    <button class="ns-widget-remove" data-id="widget-insights" title="Remove widget">&times;</button>
                    <h3>Quick Insights</h3>
                    <ul class="ns-insights-list" id="ns-insights-list">
                        <li><strong>Machine Learning:</strong> You are struggling with Regularization. Review recommended.</li>
                        <li><strong>Data Structures:</strong> Graph traversals mastery is up 15%.</li>
                        <li><strong>Optimization:</strong> Assignment 2 predicted score is 90%.</li>
                    </ul>
                </div>
            `,
            target: ".ns-courses-sidebar"
        }
    ];

    // Read stored widgets or display defaults
    let activeWidgets = JSON.parse(localStorage.getItem("ns-dashboard-widgets")) || WIDGETS.map(w => w.id);

    function saveWidgets() {
        localStorage.setItem("ns-dashboard-widgets", JSON.stringify(activeWidgets));
    }

    // Wrap the top container to render dynamic widgets
    const viewCourses = document.getElementById("view-courses");
    if (!viewCourses) return;

    // Clear static widgets if they exist and render dynamically
    const dashboardTop = viewCourses.querySelector(".ns-dashboard-top");
    const sidebar = viewCourses.querySelector(".ns-courses-sidebar");
    
    // Convert existing static DOM elements to dynamic so we don't duplicate
    if (dashboardTop) dashboardTop.innerHTML = "";
    if (sidebar) sidebar.innerHTML = "";

    function renderWidgets() {
        if (dashboardTop) dashboardTop.innerHTML = "";
        if (sidebar) sidebar.innerHTML = "";
        
        activeWidgets.forEach(widgetId => {
            const w = WIDGETS.find(x => x.id === widgetId);
            if (w) {
                const target = w.target === ".ns-dashboard-top" ? dashboardTop : sidebar;
                if (target) {
                    target.insertAdjacentHTML('beforeend', w.html);
                }
            }
        });

        // Add event listeners to remove buttons
        document.querySelectorAll(".ns-widget-remove").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.target.getAttribute("data-id");
                removeWidget(id);
            });
        });
        
        
        updatePopupOptions();
        
        // Let app.js refresh dynamic values if defined globally
        if (typeof window.fetchAndApplyBackendData === "function") {
            window.fetchAndApplyBackendData();
        }
    }

    function removeWidget(id) {
        activeWidgets = activeWidgets.filter(w => w !== id);
        saveWidgets();
        renderWidgets();
    }

    function addWidget(id) {
        if (!activeWidgets.includes(id)) {
            activeWidgets.push(id);
            saveWidgets();
            renderWidgets();
        }
    }

    // Create Add Widget button and popup BEFORE calling renderWidgets
    const addBtnContainerHtml = `
      <div id="ns-add-widget-container" style="display: flex; justify-content: center; width: 100%; margin: 20px 0; padding-bottom: 20px; clear: both;">
        <button class="ns-add-widget-btn" id="add-widget-btn">+ Add Widgets</button>
      </div>
    `;
    viewCourses.insertAdjacentHTML('beforeend', addBtnContainerHtml);

    const popupHtml = `
        <div class="widget-popup" id="widget-popup">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4>Add Widget</h4>
                <button id="close-widget-popup" style="background:none; border:none; font-size:18px; cursor:pointer;">&times;</button>
            </div>
            <div id="widget-options-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHtml);

    const addBtn = document.getElementById("add-widget-btn");
    const popup = document.getElementById("widget-popup");
    const closeBtn = document.getElementById("close-widget-popup");
    const optionsList = document.getElementById("widget-options-list");

    // NOW it's safe to call renderWidgets (which calls updatePopupOptions)
    renderWidgets();

    // Element references are already defined above renderWidgets

    function updatePopupOptions() {
        optionsList.innerHTML = "";
        WIDGETS.forEach(w => {
            const isActive = activeWidgets.includes(w.id);
            const opt = document.createElement("div");
            opt.className = "widget-option" + (isActive ? " disabled" : "");
            opt.innerHTML = `
                <span>${w.title}</span>
                <span>${isActive ? "✓" : "+"}</span>
            `;
            if (!isActive) {
                opt.addEventListener("click", () => {
                    addWidget(w.id);
                });
            }
            optionsList.appendChild(opt);
        });
    }

    addBtn.addEventListener("click", () => {
        popup.classList.toggle("show");
    });

    closeBtn.addEventListener("click", () => {
        popup.classList.remove("show");
    });

    document.addEventListener("click", (e) => {
        if (!popup.contains(e.target) && e.target !== addBtn) {
            popup.classList.remove("show");
        }
    });
});
