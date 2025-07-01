# Load Runner - Employee Performance & Roster App

![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

A comprehensive web application designed to track employee load-running performance in real-time and generate intelligent weekly rosters using the Google Gemini AI.


---

## Key Features

* **Secure Authentication:** Separate login systems for general store access and a protected manager's dashboard.
* **Real-time Load Timer:** Employees can select their name and a load category to start a timer, which is displayed live for all users in that store.
* **Manager Dashboard:** A powerful analytics and management hub with multiple views:
    * **Activity View:** Browse all completed loads by any employee on a specific date.
    * **Monthly Rankings:** See top-performing employees across all categories for the current month.
    * **Detailed View:** Get a granular breakdown of an individual employee's performance metrics.
    * **Performance Graph:** Visualize monthly performance trends for the last 12 months with category filtering.
    * **Employee Management:** Add, remove, and edit employee details, including contract hours and days off.
* **AI-Powered Roster Generation:**
    * Automatically generate a full week's roster based on employee availability, contract hours, and custom rules.
    * Uses the Google Gemini API for intelligent scheduling.
* **Persistent Data:**
    * All load times and employee details are saved securely in Firestore.
    * Generated rosters are saved on a day-by-day basis and can be navigated week by week.
* **Data Management:** Managers have the ability to reset all load times or all generated rosters for the store.

---

## Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Backend & Database:** [Firebase](https://firebase.google.com/)
    * **Authentication:** For secure user and manager logins.
    * **Firestore:** Real-time NoSQL database for storing all application data.
    * **Hosting:** For deploying the live application.
* **AI:** [Google Gemini API](https://ai.google.dev/) for roster generation.
* **Charting:** [Chart.js](https://www.chartjs.org/) for performance graphs.

---

## Project Structure


/
├── dist/              # The build output directory for deployment
├── node_modules/      # Project dependencies
├── src/
│   ├── manager.js     # Logic for the manager dashboard
│   ├── style.css      # Main stylesheet (Tailwind & custom)
│   └── timer.js       # Logic for the employee timer page
├── .env.local         # Local environment variables (API keys) - MUST be created
├── .gitignore         # Files to be ignored by Git
├── index.html         # Store login page
├── manager.html       # Manager dashboard page
├── timer.html         # Employee timer page
├── package.json       # Project dependencies and scripts
└── vite.config.js     # Vite configuration for multiple pages


---

## Setup and Installation

### 1. Clone the Repository

```bash
git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
cd your-repo-name

2. Install Dependencies
Install all the necessary packages using npm.

npm install

3. Set Up Environment Variables
This is a critical step for connecting to Firebase and Google AI.

Create a new file in the root of the project named .env.local.

Add your secret API keys to this file. Vite will automatically load them. This file is included in .gitignore and should never be committed to your repository.

# .env.local

# Firebase Configuration
VITE_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
VITE_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
VITE_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID"
VITE_FIREBASE_APP_ID="YOUR_APP_ID"

# Gemini API Key
VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

4. Run the Development Server
Start the Vite development server. This will open the application on a local URL (e.g., http://localhost:5173) with hot-reloading enabled.

npm run dev

5. Build for Production
When you are ready to deploy, create an optimized production build in the dist/ folder.

npm run build

Firebase Deployment
Install Firebase CLI: If you haven't already, install the Firebase command-line tools globally.

npm install -g firebase-tools

Login to Firebase:

firebase login

Initialize Firebase: If this is the first time deploying from this project, initialize Firebase.

firebase init

Select Hosting.

Choose an existing project.

Set your public directory to dist.

Configure as a single-page app? No.

Deploy:

firebase deploy

</markdown>
