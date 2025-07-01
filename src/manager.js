// =================================================================
// 1. IMPORT LIBRARIES & STYLES
// =================================================================
import './style.css'; 

// Import libraries from node_modules
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, Timestamp, onSnapshot, addDoc, deleteDoc, doc, writeBatch, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Chart from 'chart.js/auto';


// =================================================================
// 2. CONFIGURATION & INITIALIZATION
// =================================================================

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// =================================================================
// 3. APPLICATION LOGIC
// =================================================================

const App = {
    db: null, auth: null, storeId: null, chartInstance: null,
    state: { employees: {}, monthlyData: null, activityData: null, graphData: null, activityDate: null, rosterStartDate: null },
    elements: {},

    init() {
        // Select all elements after DOM is loaded
        App.elements = {
            authView: document.getElementById('auth-view'),
            dashboardView: document.getElementById('dashboard-view'),
            authForm: document.getElementById('auth-form'),
            authError: document.getElementById('auth-error'),
            usernameInput: document.getElementById('username'),
            passwordInput: document.getElementById('password'),
            managerUsernameSpan: document.getElementById('manager-username'),
            logoutButton: document.getElementById('logout-button'),
            tabs: document.querySelectorAll('.tab-button'),
            views: document.querySelectorAll('.view'),
            viewContentPlaceholder: document.getElementById('view-content-placeholder'),
            rankingsContainer: document.getElementById('rankings-container'),
            detailsEmployeeList: document.getElementById('details-employee-list'),
            employeeDetailsContainer: document.getElementById('employee-details-container'),
            employeeDetailsPlaceholder: document.getElementById('employee-details-placeholder'),
            storeAveragesDetails: document.getElementById('store-averages-details'),
            employeeManagementList: document.getElementById('employee-management-list'),
            addEmployeeForm: document.getElementById('add-employee-form'),
            resetModal: document.getElementById('reset-modal'),
            openResetModalButton: document.getElementById('open-reset-modal-button'),
            cancelResetButton: document.getElementById('cancel-reset-button'),
            confirmResetButton: document.getElementById('confirm-reset-button'),
            resetConfirmInput: document.getElementById('reset-confirm-input'),
            graphPlaceholder: document.getElementById('graph-placeholder'),
            performanceChart: document.getElementById('performance-chart'),
            datePicker: document.getElementById('date-picker'),
            prevDayBtn: document.getElementById('prev-day-btn'),
            nextDayBtn: document.getElementById('next-day-btn'),
            activityEmployeeList: document.getElementById('activity-employee-list'),
            activityDetailsPlaceholder: document.getElementById('activity-details-placeholder'),
            activityDetailsContainer: document.getElementById('activity-details-container'),
            employeeSettingsModal: document.getElementById('employee-settings-modal'),
            employeeSettingsForm: document.getElementById('employee-settings-form'),
            cancelSettingsButton: document.getElementById('cancel-settings-button'),
            graphCategoryFilters: document.getElementById('graph-category-filters'),
            rosterGridContainer: document.getElementById('roster-grid-container'),
            rosterRulesButton: document.getElementById('roster-rules-button'),
            rosterRulesModal: document.getElementById('roster-rules-modal'),
            rosterRulesForm: document.getElementById('roster-rules-form'),
            cancelRosterRulesButton: document.getElementById('cancel-roster-rules-button'),
            rosterPrevWeekBtn: document.getElementById('roster-prev-week-btn'),
            rosterNextWeekBtn: document.getElementById('roster-next-week-btn'),
            rosterWeekDisplay: document.getElementById('roster-week-display'),
            generateRosterButton: document.getElementById('generate-roster-button'),
            generateRosterModal: document.getElementById('generate-roster-modal'),
            generateRosterForm: document.getElementById('generate-roster-form'),
            cancelGenerateRosterButton: document.getElementById('cancel-generate-roster-button'),
            // New element for the reset button
            resetRosterButton: document.getElementById('reset-roster-button'),
        };
        
        const firebaseApp = initializeApp(firebaseConfig);
        App.auth = getAuth(firebaseApp);
        App.db = getFirestore(firebaseApp);
        App.storeId = new URLSearchParams(window.location.search).get('store');
        
        if (!App.storeId) {
            if (App.elements.authView) {
                App.elements.authView.innerHTML = `<div class="text-center text-red-600">No store context provided.</div>`;
            }
            return;
        }
        
        document.getElementById('store-id-display').textContent = App.storeId;
        document.getElementById('back-to-timer-link').href = `/timer.html?store=${App.storeId}`;
        document.getElementById('login-back-button').href = `/timer.html?store=${App.storeId}`;
        
        App.attachListeners();
        App.handleAuthChanges();
    },

    attachListeners() {
        if (!App.elements.authForm) return;
        App.elements.authForm.addEventListener('submit', Auth.handleLogin);
        App.elements.logoutButton.addEventListener('click', () => App.auth.signOut());
        App.elements.tabs.forEach(tab => tab.addEventListener('click', (e) => UI.switchTab(e.currentTarget.dataset.tab)));
        App.elements.addEmployeeForm.addEventListener('submit', EmployeeManager.add);
        App.elements.employeeManagementList.addEventListener('click', EmployeeManager.handleListClick);
        App.elements.activityDetailsContainer.addEventListener('click', DataManager.deleteLoad);
        App.elements.openResetModalButton.addEventListener('click', () => App.elements.resetModal.classList.remove('hidden'));
        App.elements.cancelResetButton.addEventListener('click', UI.closeResetModal);
        App.elements.resetConfirmInput.addEventListener('input', UI.handleResetConfirmationInput);
        App.elements.confirmResetButton.addEventListener('click', DataManager.resetLoadTimes);
        App.elements.datePicker.addEventListener('change', (e) => Views.Activity.changeDate(new Date(e.target.value.replace(/-/g, '/'))));
        App.elements.prevDayBtn.addEventListener('click', () => Views.Activity.navigateDay(-1));
        App.elements.nextDayBtn.addEventListener('click', () => Views.Activity.navigateDay(1));
        App.elements.employeeSettingsForm.addEventListener('submit', EmployeeManager.saveSettings);
        App.elements.cancelSettingsButton.addEventListener('click', () => App.elements.employeeSettingsModal.classList.add('hidden'));
        App.elements.graphCategoryFilters.addEventListener('change', () => Views.Graph.renderChart(App.state.graphData));
        App.elements.rosterRulesButton.addEventListener('click', Views.Roster.openRulesModal);
        App.elements.cancelRosterRulesButton.addEventListener('click', () => App.elements.rosterRulesModal.classList.add('hidden'));
        App.elements.rosterRulesForm.addEventListener('submit', Views.Roster.saveRules);
        App.elements.rosterPrevWeekBtn.addEventListener('click', () => Views.Roster.navigateWeek(-7));
        App.elements.rosterNextWeekBtn.addEventListener('click', () => Views.Roster.navigateWeek(7));
        App.elements.generateRosterButton.addEventListener('click', Views.Roster.openGenerateModal);
        App.elements.cancelGenerateRosterButton.addEventListener('click', () => App.elements.generateRosterModal.classList.add('hidden'));
        App.elements.generateRosterForm.addEventListener('submit', Views.Roster.generateRoster);
        // New listener for the reset button
        if (App.elements.resetRosterButton) {
            App.elements.resetRosterButton.addEventListener('click', Views.Roster.resetRosters);
        }
    },
    
    handleAuthChanges() {
        onAuthStateChanged(App.auth, (user) => {
            if (user && user.email.endsWith('@manager.loadrun.app')) {
                App.elements.authView.classList.add('hidden');
                App.elements.dashboardView.classList.remove('hidden');
                App.elements.managerUsernameSpan.textContent = `Welcome, ${user.email.split('@')[0]}`;
                EmployeeManager.listen();
                UI.switchTab('activity');
            } else {
                App.elements.authView.classList.remove('hidden');
                App.elements.dashboardView.classList.add('hidden');
            }
        });
    }
};

const Auth = {
    handleLogin(e) {
        e.preventDefault();
        const email = `${App.elements.usernameInput.value.trim()}@manager.loadrun.app`;
        const password = App.elements.passwordInput.value;
        signInWithEmailAndPassword(App.auth, email, password).catch((error) => {
            console.error("Login Error:", error.code, error.message);
            App.elements.authError.textContent = "Invalid Manager username or password.";
            App.elements.authError.classList.remove('hidden');
        });
    }
};

const EmployeeManager = {
    listen() {
        const employeesRef = collection(App.db, `stores/${App.storeId}/employees`);
        onSnapshot(employeesRef, (snapshot) => {
            App.state.employees = {};
            const employeeArray = [];
            snapshot.forEach(doc => {
                const employee = { id: doc.id, ...doc.data() };
                App.state.employees[doc.id] = employee;
                employeeArray.push(employee);
            });
            
            const getLastName = (fullName) => {
                const parts = fullName.split(' ');
                return parts.length > 1 ? parts[parts.length - 1] : fullName;
            };
            employeeArray.sort((a,b) => getLastName(a.name).localeCompare(getLastName(b.name)));
            
            this.renderList(employeeArray);
            App.state.monthlyData = null;
            App.state.activityData = null;
            App.state.graphData = null;
        });
    },
    renderList(employeeArray) {
        App.elements.employeeManagementList.innerHTML = '';
        if (employeeArray.length === 0) {
            App.elements.employeeManagementList.innerHTML = `<p class="text-sm text-gray-500">No employees added.</p>`;
            return;
        }
        employeeArray.forEach(employee => {
            const li = document.createElement('li');
            li.className = "flex justify-between items-center bg-gray-50 p-3 rounded-lg";
            li.innerHTML = `
                <span class="font-medium">${employee.name}</span>
                <div class="flex items-center space-x-4">
                    <button data-id="${employee.id}" class="settings-employee-btn text-gray-500 hover:text-blue-600" title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734-2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>
                            </button>
                            <button data-id="${employee.id}" class="delete-employee-btn text-red-500 hover:text-red-700 font-semibold">Remove</button>
                        </div>
                    `;
            App.elements.employeeManagementList.appendChild(li);
        });
    },
    async add(e) {
        e.preventDefault();
        const firstName = document.getElementById('first-name-input').value.trim();
        const lastName = document.getElementById('last-name-input').value.trim();
        if (firstName && lastName) {
            await addDoc(collection(App.db, `stores/${App.storeId}/employees`), { 
                name: `${firstName} ${lastName}`,
                contractHours: 0,
                daysOff: [],
                isManager: 'Not a Manager',
                timeOffNotes: ''
            });
            e.target.reset();
        } else {
            alert("Both first and last name are required.");
        }
    },
    handleListClick(e) {
        const target = e.target.closest('button');
        if (!target) return;
        const employeeId = target.dataset.id;
        if (target.classList.contains('delete-employee-btn')) {
            EmployeeManager.remove(employeeId);
        } else if (target.classList.contains('settings-employee-btn')) {
            EmployeeManager.openSettings(employeeId);
        }
    },
    async remove(employeeId) {
        const employeeName = App.state.employees[employeeId]?.name || 'this employee';
        if (window.confirm(`Are you sure you want to remove ${employeeName}?`)) {
            await deleteDoc(doc(App.db, `stores/${App.storeId}/employees`, employeeId));
        }
    },
    openSettings(employeeId) {
        const employee = App.state.employees[employeeId];
        if (!employee) return;

        document.getElementById('settings-employee-name').textContent = employee.name;
        const form = App.elements.employeeSettingsForm;
        form.querySelector('#settings-employee-id').value = employeeId;
        form.querySelector('#contract-hours').value = employee.contractHours || 0;
        form.querySelector('#time-off-notes').value = employee.timeOffNotes || '';
        form.querySelector('#manager-role').value = employee.isManager || 'Not a Manager';
        
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const checkboxesContainer = form.querySelector('#days-off-checkboxes');
        checkboxesContainer.innerHTML = days.map(day => `
            <label class="flex items-center space-x-2">
                <input type="checkbox" value="${day}" class="day-off-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                <span>${day}</span>
            </label>
        `).join('');

        const currentDaysOff = employee.daysOff || [];
        checkboxesContainer.querySelectorAll('.day-off-checkbox').forEach(cb => {
            cb.checked = currentDaysOff.includes(cb.value);
        });

        App.elements.employeeSettingsModal.classList.remove('hidden');
    },
    async saveSettings(e) {
        e.preventDefault();
        const form = e.target;
        const employeeId = form.querySelector('#settings-employee-id').value;
        if (!employeeId) return;

        const daysOff = [];
        form.querySelectorAll('.day-off-checkbox:checked').forEach(cb => {
            daysOff.push(cb.value);
        });
        
        const updatedData = {
            contractHours: Number(form.querySelector('#contract-hours').value) || 0,
            timeOffNotes: form.querySelector('#time-off-notes').value.trim(),
            isManager: form.querySelector('#manager-role').value,
            daysOff: daysOff
        };

        const employeeRef = doc(App.db, `stores/${App.storeId}/employees`, employeeId);
        await updateDoc(employeeRef, updatedData);
        
        App.elements.employeeSettingsModal.classList.add('hidden');
    }
};

const DataManager = {
    CATEGORIES: ["Ambient", "Freezer", "Short Life", "Long Life", "Produce", "Bread", "Freezer Thaw"],
    async fetch(startDate, endDate) {
        const sessionsRef = collection(App.db, `stores/${App.storeId}/load_sessions`);
        const q = query(sessionsRef, where("status", "==", "completed"), where("endTime", ">=", Timestamp.fromDate(startDate)), where("endTime", "<=", Timestamp.fromDate(endDate)));
        return await getDocs(q);
    },
    process(sessionsSnapshot) {
        const employeeStats = {};
        const storeStats = { categories: {} };
        this.CATEGORIES.forEach(cat => storeStats.categories[cat] = { totalCases: 0, totalDuration: 0, totalUglies: 0, runCount: 0 });
        sessionsSnapshot.forEach(doc => {
            const load = doc.data();
            if (!load.category || !load.employeeId || !App.state.employees[load.employeeId] || !this.CATEGORIES.includes(load.category)) return;
            if (!employeeStats[load.employeeId]) {
                employeeStats[load.employeeId] = { name: App.state.employees[load.employeeId].name, categories: {} };
                this.CATEGORIES.forEach(cat => employeeStats[load.employeeId].categories[cat] = { totalCases: 0, totalDuration: 0, totalUglies: 0, runCount: 0 });
            }
            const empCat = employeeStats[load.employeeId].categories[load.category];
            const storeCat = storeStats.categories[load.category];
            empCat.runCount++;
            empCat.totalCases += load.quantity || 0;
            empCat.totalDuration += load.durationMinutes || 0;
            empCat.totalUglies += load.uglies || 0;
            storeCat.runCount++;
            storeCat.totalCases += load.quantity || 0;
            storeCat.totalDuration += load.durationMinutes || 0;
            storeCat.totalUglies += load.uglies || 0;
        });
        Object.values(employeeStats).forEach(emp => Object.values(emp.categories).forEach(this.calculateMetrics));
        Object.values(storeStats.categories).forEach(this.calculateMetrics);
        return { employeeStats, storeStats };
    },
    calculateMetrics(data) {
        data.casesPerMin = data.totalDuration > 0 ? data.totalCases / data.totalDuration : 0;
        data.casesPerHour = data.casesPerMin * 60;
        data.ugliesPercentage = data.totalCases > 0 ? (data.totalUglies / data.totalCases) * 100 : 0;
        data.avgPalletSpeed = data.runCount > 0 ? data.totalDuration / data.runCount : 0;
        data.avgCasesPerPallet = data.runCount > 0 ? data.totalCases / data.runCount : 0;
    },
    async resetLoadTimes() {
        UI.setResetButtonState(true, 'Resetting...');
        const loadSessionsRef = collection(App.db, `stores/${App.storeId}/load_sessions`);
        const snapshot = await getDocs(loadSessionsRef);
        if (snapshot.empty) {
            alert('There are no load times to reset.');
        } else {
            const batch = writeBatch(App.db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            alert('All load times have been successfully reset.');
        }
        UI.closeResetModal();
        const currentTab = document.querySelector('.tab-button.active').dataset.tab;
        UI.switchTab(currentTab);
    },
    async deleteLoad(e) {
        if (!e.target.classList.contains('delete-load-btn')) return;
        const loadId = e.target.dataset.loadId;
        if (window.confirm('Are you sure you want to permanently delete this load record?')) {
            try {
                await deleteDoc(doc(App.db, `stores/${App.storeId}/load_sessions`, loadId));
                alert('Load record deleted successfully.');
                UI.switchTab(document.querySelector('.tab-button.active').dataset.tab);
            } catch (error) {
                alert("Failed to delete load record.");
            }
        }
    }
};

const UI = {
    async switchTab(tabName) {
        this.showPlaceholder(true);
        this.setActiveTab(tabName);
        if (tabName === 'activity') await Views.Activity.render();
        else if (tabName === 'rankings' || tabName === 'details') await Views.Monthly.render();
        else if (tabName === 'graph') await Views.Graph.render();
        else if (tabName === 'employees') Views.Employees.render();
        else if (tabName === 'roster') await Views.Roster.render();
        this.showPlaceholder(false);
        this.showView(tabName);
    },
    setActiveTab(tabName) {
        App.elements.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    },
    showView(viewName) {
        App.elements.views.forEach(v => v.classList.toggle('hidden', v.id !== `${viewName}-view`));
    },
    showPlaceholder(show) {
        App.elements.viewContentPlaceholder.classList.toggle('hidden', !show);
    },
    closeResetModal() {
        App.elements.resetConfirmInput.value = '';
        UI.setResetButtonState(true, 'Confirm Reset');
        App.elements.resetModal.classList.add('hidden');
    },
    setResetButtonState(disabled, text) {
        const btn = App.elements.confirmResetButton;
        btn.disabled = disabled;
        btn.textContent = text;
        btn.classList.toggle('bg-red-400', disabled);
        btn.classList.toggle('cursor-not-allowed', disabled);
        btn.classList.toggle('bg-red-600', !disabled);
        btn.classList.toggle('hover:bg-red-700', !disabled);
    },
    handleResetConfirmationInput(e) {
        UI.setResetButtonState(e.target.value !== 'RESET', 'Confirm Reset');
    },
    setLoading(isLoading) {
        if (isLoading) {
            if (document.getElementById('loading-overlay')) return;
            const overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'fixed inset-0 z-50 bg-black/70 text-white flex flex-col items-center justify-center gap-4';
            overlay.innerHTML = `
                <svg class="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-lg font-semibold">Generating Roster...</p>
            `;
            document.body.appendChild(overlay);
        } else {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    }
};

const Views = {
    Employees: {
        render() {
            EmployeeManager.renderList(Object.values(App.state.employees));
        }
    },
    Activity: {
        async render() {
            if (!App.state.activityDate) App.state.activityDate = new Date();
            const date = App.state.activityDate;
            App.elements.datePicker.value = date.toISOString().split('T')[0];
            const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);
            const sessions = await DataManager.fetch(startOfDay, endOfDay);
            this.renderEmployeeList(sessions);
        },
        renderEmployeeList(sessionsSnapshot) {
            const loadsByEmployee = {};
            const employeesOnDate = new Set();
            sessionsSnapshot.forEach(doc => {
                const load = { id: doc.id, ...doc.data() };
                if (!load.employeeId || !App.state.employees[load.employeeId]) return;
                employeesOnDate.add(load.employeeId);
                if (!loadsByEmployee[load.employeeId]) loadsByEmployee[load.employeeId] = [];
                loadsByEmployee[load.employeeId].push(load);
            });
            App.elements.activityDetailsPlaceholder.classList.remove('hidden');
            App.elements.activityDetailsContainer.classList.add('hidden');
            if (employeesOnDate.size === 0) {
                App.elements.activityEmployeeList.innerHTML = '<p class="text-sm text-gray-500">No activity recorded on this date.</p>';
            } else {
                App.elements.activityEmployeeList.innerHTML = Array.from(employeesOnDate).map(id => `<button class="employee-button w-full text-left p-3 rounded-lg hover:bg-gray-100" data-employee-id="${id}">${App.state.employees[id]?.name || 'Unknown'}</button>`).join('');
                App.elements.activityEmployeeList.querySelectorAll('.employee-button').forEach(btn => btn.addEventListener('click', e => {
                    document.querySelectorAll('#activity-employee-list .employee-button').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.renderDetails(loadsByEmployee[e.currentTarget.dataset.employeeId]);
                }));
            }
        },
        renderDetails(loads) {
            App.elements.activityDetailsPlaceholder.classList.add('hidden');
            App.elements.activityDetailsContainer.classList.remove('hidden');
            const loadsByCategory = {};
            loads.forEach(load => {
                if (!loadsByCategory[load.category]) loadsByCategory[load.category] = [];
                loadsByCategory[load.category].push(load);
            });
            App.elements.activityDetailsContainer.innerHTML = Object.entries(loadsByCategory).map(([category, categoryLoads]) => {
                const categoryHtml = categoryLoads.sort((a,b) => b.endTime.toMillis() - a.endTime.toMillis()).map(load => `
                    <div class="bg-white rounded-xl shadow p-4 relative">
                        <button data-load-id="${load.id}" title="Delete this load" class="delete-load-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full w-6 h-6 flex items-center justify-center font-bold">&times;</button>
                        <div class="grid grid-cols-3 gap-4 text-sm font-semibold border-b pb-2 mb-2">
                            <p>ASN: <span class="font-normal">${load.asn}</span></p>
                            <p>Qty: <span class="font-normal">${load.quantity}</span></p>
                            <p>Cases/Hour: <span class="font-semibold text-blue-600">${(load.casesPerHour || 0).toFixed(2)}</span></p>
                        </div>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <p>Time: <span class="font-normal">${(load.durationMinutes || 0).toFixed(2)} min</span></p>
                            <p>Uglies: <span class="font-normal">${load.uglies || 0}</span></p>
                        </div>
                    </div>`).join('');
                return `<div><h4 class="font-bold text-lg mb-2">${category}</h4><div class="space-y-4">${categoryHtml}</div></div>`;
            }).join('');
        },
        changeDate(newDate) {
            App.state.activityDate = newDate;
            this.render();
        },
        navigateDay(direction) {
            App.state.activityDate.setDate(App.state.activityDate.getDate() + direction);
            this.render();
        }
    },
    Monthly: {
        async render() {
            if (!App.state.monthlyData) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                App.state.monthlyData = await DataManager.fetch(startOfMonth, endOfMonth);
            }
            const { employeeStats, storeStats } = DataManager.process(App.state.monthlyData);
            this.renderRankings(employeeStats);
            this.renderStoreAverages(storeStats);
            this.renderDetailedView(employeeStats);
        },
        renderRankings(employeeStats) {
            App.elements.rankingsContainer.innerHTML = DataManager.CATEGORIES.map(category => {
                const ranked = Object.values(employeeStats)
                    .map(stats => ({ name: stats.name, ...stats.categories[category] }))
                    .filter(e => e.runCount > 0).sort((a, b) => b.casesPerHour - a.casesPerHour);
                const list = ranked.length > 0 ? `<ol class="space-y-3">${ranked.map((e, i) => `
                    <li class="flex items-baseline justify-between">
                        <span class="truncate"><span class="font-bold">${i + 1}.</span> ${e.name}</span>
                        <span class="font-semibold text-sm text-blue-600">${e.casesPerHour.toFixed(2)} cph</span>
                    </li>`).join('')}</ol>` : '<p class="text-sm text-gray-500">No data.</p>';
                return `<div class="bg-white rounded-2xl shadow-xl p-6"><h3 class="font-bold text-lg mb-4 border-b pb-2">${category}</h3>${list}</div>`;
            }).join('');
        },
        renderStoreAverages(storeStats) {
            App.elements.storeAveragesDetails.innerHTML = Object.entries(storeStats.categories).map(([name, data]) => 
                data.runCount > 0 ? `
                <div class="mb-4">
                    <h4 class="font-bold text-md text-gray-700">${name}</h4>
                    <ul class="text-sm text-gray-600 mt-2 space-y-1">
                        <li>Cases/Hour: <span class="font-semibold">${data.casesPerHour.toFixed(2)}</span></li>
                        <li>Avg Pallet Speed: <span class="font-semibold">${data.avgPalletSpeed.toFixed(2)} mins</span></li>
                        <li>Uglies %: <span class="font-semibold">${data.ugliesPercentage.toFixed(1)}%</span></li>
                    </ul>
                </div>` : ''
            ).join('');
        },
        renderDetailedView(employeeStats) {
            App.elements.detailsEmployeeList.innerHTML = Object.entries(employeeStats).sort((a,b) => a[1].name.localeCompare(b[1].name))
                .map(([id, stats]) => `<button class="employee-button w-full text-left p-3 rounded-lg hover:bg-gray-100" data-employee-id="${id}">${stats.name}</button>`).join('');
            
            App.elements.detailsEmployeeList.querySelectorAll('.employee-button').forEach(btn => btn.addEventListener('click', e => {
                document.querySelectorAll('#details-employee-list .employee-button').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.displayDetails(e.currentTarget.dataset.employeeId, employeeStats);
            }));
        },
        displayDetails(id, employeeStats) {
            const stats = employeeStats[id];
            App.elements.employeeDetailsPlaceholder.classList.add('hidden');
            App.elements.employeeDetailsContainer.classList.remove('hidden');
            App.elements.employeeDetailsContainer.innerHTML = `<h3 class="text-2xl font-bold text-gray-900">${stats.name}'s Report</h3>` +
                Object.entries(stats.categories).map(([name, data]) => 
                    data.runCount > 0 ? `
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h4 class="font-bold text-lg mb-3 border-b pb-2">${name}</h4>
                        <ul class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600">
                            <li>Total Cases: <span class="font-semibold">${data.totalCases}</span></li>
                            <li>Total Runs: <span class="font-semibold">${data.runCount}</span></li>
                            <li>Total Time: <span class="font-semibold">${data.totalDuration.toFixed(2)} mins</span></li>
                            <li>Avg Pallet Speed: <span class="font-semibold">${data.avgPalletSpeed.toFixed(2)} mins</span></li>
                            <li>Cases/Min: <span class="font-semibold text-gray-500">${data.casesPerMin.toFixed(2)}</span></li>
                            <li>Cases/Hour: <span class="font-semibold text-blue-600">${data.casesPerHour.toFixed(2)}</span></li>
                            <li>Total Uglies: <span class="font-semibold">${data.totalUglies}</span></li>
                            <li>Uglies %: <span class="font-semibold">${data.ugliesPercentage.toFixed(1)}%</span></li>
                            <li>Avg Cases/Pallet: <span class="font-semibold">${data.avgCasesPerPallet.toFixed(2)}</span></li>
                        </ul>
                    </div>` : ''
                ).join('');
        }
    },
    Graph: {
        async render() {
            if(!App.state.graphData) {
                const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                App.state.graphData = await DataManager.fetch(oneYearAgo, new Date());
            }
            this.renderFilters();
            this.renderChart(App.state.graphData);
        },
        renderFilters() {
            if (!App.elements.graphCategoryFilters) return;
            App.elements.graphCategoryFilters.innerHTML = DataManager.CATEGORIES.map(category => `
                <label class="flex items-center space-x-2">
                    <input type="checkbox" value="${category}" class="graph-category-filter h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked>
                    <span>${category}</span>
                </label>
            `).join('');
        },
        renderChart(sessionsSnapshot) {
            if (!App.elements.performanceChart) return;
            App.elements.performanceChart.style.display = 'block';
            App.elements.graphPlaceholder.classList.add('hidden');
            if(sessionsSnapshot.empty) {
                App.elements.performanceChart.style.display = 'none';
                App.elements.graphPlaceholder.classList.remove('hidden');
                if (App.chartInstance) App.chartInstance.destroy();
                return;
            }
            
            const selectedCategories = Array.from(document.querySelectorAll('.graph-category-filter:checked')).map(cb => cb.value);

            const monthlyData = {};
            const monthLabels = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
                const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
                monthLabels.push(label);
                monthlyData[key] = {};
                DataManager.CATEGORIES.forEach(c => monthlyData[key][c] = []);
            }
            sessionsSnapshot.forEach(doc => {
                const load = doc.data();
                if (!load.endTime) return; 
                const monthKey = `${load.endTime.toDate().getFullYear()}-${String(load.endTime.toDate().getMonth()).padStart(2,'0')}`;
                if (monthlyData[monthKey]?.[load.category]) {
                    monthlyData[monthKey][load.category].push(load.casesPerHour || 0);
                }
            });

            const datasets = DataManager.CATEGORIES
                .filter(category => selectedCategories.includes(category))
                .map((category) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1', '#d946ef'];
                    const data = Object.values(monthlyData).map(month => {
                        const monthData = month[category];
                        return monthData.length > 0 ? monthData.reduce((a, b) => a + b, 0) / monthData.length : 0;
                    });
                    return { label: category, data, backgroundColor: colors[DataManager.CATEGORIES.indexOf(category) % colors.length] };
                });

            if (App.chartInstance) App.chartInstance.destroy();
            const ctx = document.getElementById('performance-chart').getContext('2d');
            App.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: { labels: monthLabels, datasets: datasets },
                options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Average Cases Per Hour'} } } }
            });
        }
    },
    Roster: {
        async render() {
            let currentDate = App.state.rosterStartDate || new Date();
            if (!App.state.rosterStartDate) {
                const dayOfWeek = currentDate.getDay();
                const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                currentDate.setDate(currentDate.getDate() + diff);
                App.state.rosterStartDate = new Date(currentDate);
            } else {
                currentDate = new Date(App.state.rosterStartDate);
            }
            
            const weekDates = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(currentDate);
                date.setDate(currentDate.getDate() + i);
                weekDates.push(date.toISOString().split('T')[0]);
            }

            const rosterPromises = weekDates.map(dateStr => {
                const rosterRef = doc(App.db, `stores/${App.storeId}/rosters`, dateStr);
                return getDoc(rosterRef);
            });

            const rosterSnapshots = await Promise.all(rosterPromises);
            
            const weeklyRosterData = { roster: {} };
            rosterSnapshots.forEach((snap, index) => {
                if (snap.exists()) {
                    const dateKey = weekDates[index];
                    weeklyRosterData.roster[dateKey] = snap.data().shifts;
                }
            });

            this.renderGrid(weeklyRosterData);
        },

        renderGrid(weeklyRosterData = { roster: {} }) {
            const employees = Object.values(App.state.employees)
                .filter(employee => employee.name !== 'Transferred Employee');
            
            const getLastName = (fullName) => {
                const parts = fullName.split(' ');
                return parts.length > 1 ? parts[parts.length - 1] : fullName;
            };
            
            employees.sort((a, b) => getLastName(a.name).localeCompare(getLastName(b.name)));

            const days = [];
            let currentDate = new Date(App.state.rosterStartDate);
            
            for (let i = 0; i < 7; i++) {
                days.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            const firstDay = days[0];
            const lastDay = days[6];
            App.elements.rosterWeekDisplay.textContent = `${firstDay.toLocaleDateString()} - ${lastDay.toLocaleDateString()}`;

            let gridHtml = `<div class="grid" style="grid-template-columns: 150px repeat(7, 1fr); gap: 1px; background-color: #e5e7eb;">`;
            
            gridHtml += `<div class="p-2 font-bold bg-gray-100 sticky left-0 z-10">Employee</div>`;
            days.forEach(day => {
                const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
                const dateString = `${day.getDate()}/${day.getMonth() + 1}`;
                gridHtml += `<div class="p-2 font-bold text-center bg-gray-100"><div>${dayName}</div><div class="text-xs text-gray-500">${dateString}</div></div>`;
            });
            
            employees.forEach(employee => {
                gridHtml += `<div class="p-2 font-medium bg-white sticky left-0 z-10">${employee.name}</div>`;
                days.forEach(day => {
                    const dateKey = day.toISOString().split('T')[0];
                    let shift = "";
                    if (weeklyRosterData.roster && weeklyRosterData.roster[dateKey]) {
                        const dayRoster = weeklyRosterData.roster[dateKey];
                        const employeeShift = dayRoster.find(s => s.employeeName === employee.name);
                        if (employeeShift) {
                            shift = employeeShift.shift.replace(/\s+/g, ' ').trim();
                        }
                    }
                    gridHtml += `<div class="p-2 bg-white text-center text-xs">${shift}</div>`; 
                });
            });

            gridHtml += `</div>`;
            App.elements.rosterGridContainer.innerHTML = gridHtml;
        },
        navigateWeek(direction) {
            if (!App.state.rosterStartDate) App.state.rosterStartDate = new Date();
            App.state.rosterStartDate.setDate(App.state.rosterStartDate.getDate() + direction);
            this.render();
        },
        openGenerateModal() {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
            const monday = new Date(today.setDate(diff));

            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            document.getElementById('roster-start-date').valueAsDate = monday;
            document.getElementById('roster-end-date').valueAsDate = sunday;
            App.elements.generateRosterModal.classList.remove('hidden');
        },
        async openRulesModal() {
            const rulesRef = doc(App.db, `stores/${App.storeId}/settings`, 'rosterRules');
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                document.getElementById('roster-rules-input').value = rulesSnap.data().rules || '';
            } else {
                document.getElementById('roster-rules-input').value = '';
            }
            App.elements.rosterRulesModal.classList.remove('hidden');
        },
        async saveRules(e) {
            e.preventDefault();
            const rules = document.getElementById('roster-rules-input').value;
            const rulesRef = doc(App.db, `stores/${App.storeId}/settings`, 'rosterRules');
            await setDoc(rulesRef, { rules: rules });
            alert('Roster rules saved!');
            App.elements.rosterRulesModal.classList.add('hidden');
        },
        async generateRoster(e) {
            e.preventDefault();
            
            if (!genAI) {
                alert("The AI model is not available. Please ensure your API key is correct and you have an internet connection.");
                return;
            }

            UI.setLoading(true);

            const startDateString = document.getElementById('roster-start-date').value;
            const endDateString = document.getElementById('roster-end-date').value;

            if (!startDateString || !endDateString) {
                alert("Please select a valid date range.");
                UI.setLoading(false);
                return;
            }

            const rulesRef = doc(App.db, `stores/${App.storeId}/settings`, 'rosterRules');
            const rulesSnap = await getDoc(rulesRef);
            const rosterRules = rulesSnap.exists() ? rulesSnap.data().rules : "No specific rules provided.";

            const employeeData = Object.values(App.state.employees)
                .filter(emp => emp.name !== 'Transferred Employee')
                .map(emp => ({
                    name: emp.name,
                    contractHours: emp.contractHours,
                    daysOff: emp.daysOff,
                    timeOffNotes: emp.timeOffNotes,
                    isManager: ["RSM", "DSM", "ASM"].includes(emp.isManager)
                }));
            
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
            
            const prompt = `
                You are a roster generation assistant for a retail store.
                Generate a daily roster for the period from ${startDateString} to ${endDateString}.

                Here are the employees and their details:
                ${JSON.stringify(employeeData, null, 2)}

                Here are the rostering rules:
                - Anyone with "isManager: true" is a manager.
                ${rosterRules}

                Please provide the output as a single JSON object. The object should have one key, "roster".
                The value of "roster" should be another object where each key is a date in "YYYY-MM-DD" format.
                The value for each date should be an array of objects, where each object represents an employee's shift for that day.
                Each employee shift object should have two keys: "employeeName" and "shift".
                The "shift" value should be a string representing their work hours (e.g., "9:00 - 17:00", "OFF", "Day Off").
                Ensure every employee listed in the input data is included in the roster for every single day in the date range.
                Contract hours are fortnightly so they have to meet their contract hours every fortnight they can go slightly over but never below.

                Example of expected JSON format:
                {
                "roster": {
                    "2024-07-29": [
                    { "employeeName": "John Doe", "shift": "9:00 - 17:00" },
                    { "employeeName": "Jane Smith", "shift": "OFF" }
                    ],
                    "2024-07-30": [
                    { "employeeName": "John Doe", "shift": "OFF" },
                    { "employeeName": "Jane Smith", "shift": "10:00 - 18:00" }
                    ]
                }
                }
            `;

            try {
                const result = await model.generateContent(prompt);
                const response = result.response;
                const text = response.text();
                
                const startIndex = text.indexOf('{');
                const endIndex = text.lastIndexOf('}');
                
                if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
                    throw new Error("Could not find a valid JSON object in the AI response.");
                }

                const jsonString = text.substring(startIndex, endIndex + 1);
                const rosterJson = JSON.parse(jsonString);

                if (rosterJson.roster) {
                    const dailyRosters = rosterJson.roster;
                    const savePromises = [];

                    for (const dateKey in dailyRosters) {
                        const dailyShifts = dailyRosters[dateKey];
                        const rosterRef = doc(App.db, `stores/${App.storeId}/rosters`, dateKey);
                        savePromises.push(setDoc(rosterRef, { shifts: dailyShifts }));
                    }

                    await Promise.all(savePromises);
                    
                    console.log('Roster successfully saved to Firestore day by day!');
                    alert('Roster generated and saved successfully!');

                    await Views.Roster.render();

                } else {
                    throw new Error("Invalid JSON format from AI: 'roster' key missing.");
                }

            } catch (error) {
                console.error("CRITICAL ERROR in generateRoster:", error);
                alert(`Failed to generate or save roster. Please check the console for details. Error: ${error.message}`);
            } finally {
                UI.setLoading(false);
                App.elements.generateRosterModal.classList.add('hidden');
            }
        },
        async resetRosters() {
            if (!window.confirm("Are you sure you want to delete ALL saved rosters for this store? This action cannot be undone.")) {
                return;
            }
        
            UI.setLoading(true);
            const rostersRef = collection(App.db, `stores/${App.storeId}/rosters`);
            try {
                const snapshot = await getDocs(rostersRef);
                if (snapshot.empty) {
                    alert('There are no saved rosters to delete.');
                    return;
                }
        
                const batch = writeBatch(App.db);
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
        
                await batch.commit();
                alert('All saved rosters have been successfully deleted.');
                await Views.Roster.render();
        
            } catch (error) {
                console.error("Error deleting rosters:", error);
                alert("An error occurred while trying to delete the rosters. Please check the console for details.");
            } finally {
                UI.setLoading(false);
            }
        }
    }
};

// Start the application after the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', App.init);
