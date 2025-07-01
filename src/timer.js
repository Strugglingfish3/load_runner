import './style.css';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, onSnapshot, addDoc, updateDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// This is the main application module.
const TimerApp = {
    db: null, auth: null, storeId: null, wakeLock: null,
    state: {
        selectedEmployeeId: null,
        selectedCategory: null,
        selectedType: null,
        employees: []
    },
    elements: {},

    init() {
        // Cache all necessary DOM elements at startup
        this.elements = {
            appContainer: document.getElementById('app-container'),
            loadingView: document.getElementById('loading-view'),
            loadingText: document.getElementById('loading-text'),
            storeIdDisplay: document.getElementById('store-id-display'),
            managerLoginLink: document.getElementById('manager-login-link'),
            employeeButtons: document.getElementById('employee-buttons'),
            startTaskSection: document.getElementById('start-task-section'),
            liveLoadsList: document.getElementById('live-loads-list'),
            liveLoadsPlaceholder: document.getElementById('live-loads-placeholder'),
            asnModal: document.getElementById('asn-modal'),
            finishLoadModal: document.getElementById('finish-load-modal'),
            asnInput: document.getElementById('asn-input'),
            qtyInput: document.getElementById('qty-input'),
            modalError: document.getElementById('modal-error'),
            finishUgliesInput: document.getElementById('finish-uglies-input'),
        };
        
        this.storeId = new URLSearchParams(window.location.search).get('store');
        if (!this.storeId) {
            this.displayError('Fatal Error', 'No store ID found in URL. Please log in again from the main page.');
            return;
        }

        this.elements.storeIdDisplay.textContent = this.storeId;
        this.elements.managerLoginLink.href = `manager.html?store=${this.storeId}`;
        
        try {
            const app = initializeApp(firebaseConfig);
            this.db = getFirestore(app);
            this.auth = getAuth(app);
            this.handleAuthentication();
        } catch(error) {
                this.displayError("Firebase Error", `Could not initialize Firebase. Please check your configuration. <br><i>${error.message}</i>`);
        }
    },
    
    // Centralized error display
    displayError(title, message) {
        this.elements.loadingText.innerHTML = `<div class="p-4 bg-red-100 text-red-800 rounded-lg"><p class="font-bold text-lg">${title}</p><p class="mt-2">${message}</p></div>`;
        this.elements.loadingView.classList.remove('hidden');
        this.elements.appContainer.classList.add('hidden');
    },
    
    // Handles authentication state changes
    handleAuthentication() {
        onAuthStateChanged(this.auth, (user) => {
            if (user) {
                const userStoreId = user.email.split('@')[0];
                if (userStoreId === this.storeId) {
                    this.runAuthenticatedApp();
                } else {
                    this.displayError("Access Denied", `You are logged in as store '${userStoreId}', but trying to access '${this.storeId}'. Please <a href="index.html" class="font-bold underline">log in</a> again.`);
                }
            } else {
                this.displayError('Authentication Required', 'Redirecting to login...');
                setTimeout(() => { window.location.href = `index.html`; }, 3000);
            }
        });
    },

    // Sets up the main app after successful authentication
    async runAuthenticatedApp() {
            try {
            this.attachListeners();
            this.fetchEmployees();
            this.subscribeToLiveLoads();
            await this.requestWakeLock();
            this.elements.loadingView.classList.add('hidden');
            this.elements.appContainer.classList.remove('hidden');
        } catch (error) {
            this.displayError("Application Error", `A critical error occurred while starting the app. <br><i>${error.message}</i>`);
        }
    },

    // Attaches all event listeners
    attachListeners() {
        this.elements.employeeButtons.addEventListener('click', (e) => this.handleEmployeeSelection(e));
        document.getElementById('category-buttons').addEventListener('click', (e) => this.handleCategorySelection(e));
        document.getElementById('type-buttons').addEventListener('click', (e) => this.handleTypeSelection(e));
        document.getElementById('start-timer-button').addEventListener('click', () => this.handleStartTimer());
        document.getElementById('cancel-start-modal-button').addEventListener('click', () => this.resetAllSelections());
        document.getElementById('confirm-finish-button').addEventListener('click', (e) => this.endLoadSession(e.target.dataset.taskId));
        document.getElementById('cancel-finish-modal-button').addEventListener('click', () => this.resetAllSelections());
        this.elements.liveLoadsList.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (target && target.dataset.taskId) {
                this.openFinishModal(target.dataset.taskId);
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (this.wakeLock !== null && document.visibilityState === 'visible') {
                this.requestWakeLock();
            }
        });
    },

    // Fetches employees from Firestore
    fetchEmployees() {
        const employeesRef = collection(this.db, `stores/${this.storeId}/employees`);
        onSnapshot(employeesRef, (snapshot) => {
            this.state.employees = [];
            this.elements.employeeButtons.innerHTML = '';
            snapshot.forEach(doc => this.state.employees.push({ id: doc.id, ...doc.data() }));
            this.state.employees.sort((a, b) => a.name.localeCompare(b.name));
            
            this.state.employees.forEach(emp => {
                const button = document.createElement('button');
                button.dataset.employeeId = emp.id;
                button.textContent = emp.name;
                button.className = 'btn-base bg-gray-100 text-gray-800 p-4 rounded-lg font-semibold hover:bg-gray-200';
                this.elements.employeeButtons.appendChild(button);
            });
        }, (error) => {
                this.displayError("Data Fetch Error", `Could not load the employee list. Please check your connection and refresh.`);
        });
    },
    
    // Subscribes to real-time updates for running loads
    subscribeToLiveLoads() {
        const q = query(collection(this.db, `stores/${this.storeId}/load_sessions`), where("status", "==", "running"));
        onSnapshot(q, (snapshot) => {
            this.elements.liveLoadsList.innerHTML = '';
            this.elements.liveLoadsPlaceholder.style.display = snapshot.empty ? 'block' : 'none';
            snapshot.forEach(doc => {
                const load = doc.data();
                if (!load.startTime) return;
                const startTime = load.startTime.toDate();
                const loadElement = document.createElement('button');
                loadElement.className = 'w-full text-left flex justify-between items-center bg-gray-50 p-3 rounded-lg hover:bg-red-100';
                loadElement.dataset.taskId = doc.id;
                loadElement.innerHTML = `<div><p class="font-semibold">${load.employeeName}</p><p class="text-sm text-gray-500">${load.category} - ${load.type}</p></div><div class="text-right"><p class="font-medium text-red-600">Click to Finish</p><p class="text-sm text-gray-500">Started at ${startTime.toLocaleTimeString()}</p></div>`;
                this.elements.liveLoadsList.appendChild(loadElement);
            });
        }, (error) => {
            this.displayError("Data Fetch Error", `Could not load live sessions. Please check your connection and refresh.`);
        });
    },

    // Handles selection of an employee
    async handleEmployeeSelection(e) {
        const button = e.target.closest('button');
        if (!button || !button.dataset.employeeId) return;
        
        this.resetAllSelections();
        this.state.selectedEmployeeId = button.dataset.employeeId;
        button.classList.add('selected');

        try {
            const q = query(collection(this.db, `stores/${this.storeId}/load_sessions`), where("employeeId", "==", this.state.selectedEmployeeId), where("status", "==", "running"));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                this.elements.startTaskSection.classList.remove('hidden');
            } else {
                const taskId = snapshot.docs[0].id;
                this.openFinishModal(taskId);
            }
        } catch(error) {
            this.displayError("Task Check Error", "Could not check for an existing task.");
        }
    },

    handleCategorySelection(e) {
        const button = e.target.closest('button');
        if (button && button.dataset.category) {
            this.state.selectedCategory = button.dataset.category;
            document.querySelectorAll('#category-buttons button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            this.checkIfReadyToStart();
        }
    },

    handleTypeSelection(e) {
        const button = e.target.closest('button');
        if (button && button.dataset.type) {
            this.state.selectedType = button.dataset.type;
            document.querySelectorAll('#type-buttons button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            this.checkIfReadyToStart();
        }
    },

    checkIfReadyToStart() {
        if (this.state.selectedEmployeeId && this.state.selectedCategory && this.state.selectedType) {
            this.elements.asnModal.classList.remove('hidden');
            this.elements.asnInput.focus();
        }
    },

    async handleStartTimer() {
        const asn = this.elements.asnInput.value.trim();
        const qty = parseInt(this.elements.qtyInput.value, 10);
        
        if (!/^\d{4}$/.test(asn)) { 
            this.elements.modalError.textContent = 'ASN must be exactly 4 digits.'; 
            this.elements.modalError.classList.remove('hidden'); 
            return; 
        }
        if (isNaN(qty) || qty <= 0) { 
            this.elements.modalError.textContent = 'Enter a valid, positive quantity.'; 
            this.elements.modalError.classList.remove('hidden'); 
            return; 
        }

        const employee = this.state.employees.find(e => e.id === this.state.selectedEmployeeId);
        const newLoad = { 
            employeeId: this.state.selectedEmployeeId, 
            employeeName: employee.name, 
            category: this.state.selectedCategory, 
            type: this.state.selectedType, 
            asn, 
            quantity: qty, 
            startTime: serverTimestamp(), 
            status: "running" 
        };
        
        try {
            await addDoc(collection(this.db, `stores/${this.storeId}/load_sessions`), newLoad);
            this.resetAllSelections();
        } catch (error) {
            this.displayError("Save Error", "Failed to save the new load session.");
        }
    },
    
    // Finishes a load session
    async endLoadSession(taskId) {
        if (!taskId) return;
        const taskDocRef = doc(this.db, `stores/${this.storeId}/load_sessions`, taskId);
        try {
            const taskDocSnapshot = await getDoc(taskDocRef);
            if (taskDocSnapshot.exists()) {
                const ugliesCount = parseInt(this.elements.finishUgliesInput.value, 10) || 0;
                const taskData = taskDocSnapshot.data();
                const startTime = taskData.startTime.toDate();
                const endTime = new Date();
                const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
                const casesPerMinute = taskData.quantity / (durationMinutes > 0 ? durationMinutes : 1);
                const casesPerHour = casesPerMinute * 60;
                
                await updateDoc(taskDocRef, {
                    endTime: serverTimestamp(),
                    status: "completed",
                    durationMinutes: parseFloat(durationMinutes.toFixed(2)),
                    casesPerMinute: parseFloat(casesPerMinute.toFixed(2)),
                    casesPerHour: parseFloat(casesPerHour.toFixed(2)),
                    uglies: ugliesCount 
                });
                
                this.alert(`Load Finished!`, `Cases per Hour: ${casesPerHour.toFixed(2)}`);
                this.resetAllSelections();
            }
        } catch (error) {
            this.displayError("Update Error", "Failed to update the load session.");
        }
    },

    // Opens the modal to finish a task
    async openFinishModal(taskId) {
        const taskDocRef = doc(this.db, `stores/${this.storeId}/load_sessions`, taskId);
        const taskDocSnapshot = await getDoc(taskDocRef);
        if (taskDocSnapshot.exists()) {
            const task = taskDocSnapshot.data();
            document.getElementById('finish-modal-employee-name').textContent = task.employeeName;
            document.getElementById('finish-modal-category').textContent = task.category;
            document.getElementById('finish-modal-type').textContent = task.type;
            document.getElementById('confirm-finish-button').dataset.taskId = taskId;
            this.elements.finishLoadModal.classList.remove('hidden');
        } else {
            this.displayError("Task Not Found", "The selected task may have been completed already.");
        }
    },
    
    // Resets the UI state completely
    resetAllSelections() {
        // Deselect employee buttons
        document.querySelectorAll('#employee-buttons button').forEach(btn => btn.classList.remove('selected'));
        this.state.selectedEmployeeId = null;
        // Hide secondary sections
        this.elements.startTaskSection.classList.add('hidden');
        // Deselect category and type
        document.querySelectorAll('#category-buttons button, #type-buttons button').forEach(btn => btn.classList.remove('selected'));
        this.state.selectedCategory = null;
        this.state.selectedType = null;
        // Hide modals and clear inputs
        this.elements.asnModal.classList.add('hidden');
        this.elements.asnInput.value = '';
        this.elements.qtyInput.value = '';
        this.elements.modalError.classList.add('hidden');
        this.elements.finishLoadModal.classList.add('hidden');
        this.elements.finishUgliesInput.value = 0;
    },

    // Requests a screen wake lock to prevent the device from sleeping
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
            } catch (err) {
                console.error(`Wake Lock request failed: ${err.name}, ${err.message}`);
            }
        }
    },
    
    // A custom, non-blocking alert function
    alert(title, message) {
        const alertBox = document.createElement('div');
        alertBox.className = 'fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50';
        alertBox.innerHTML = `<div class="bg-white rounded-lg p-8 shadow-2xl text-center"><h3 class="text-lg font-bold">${title}</h3><p class="my-4 whitespace-pre-wrap">${message}</p><button class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">OK</button></div>`;
        alertBox.querySelector('button').addEventListener('click', () => alertBox.remove());
        document.body.appendChild(alertBox);
    }
};

// Initialize the app once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    TimerApp.init();
});