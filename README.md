# SCORM LXP Backend

## Overview
This project is a backend application designed to handle SCORM (Sharable Content Object Reference Model) progress data. It utilizes Node.js with Express to create a server that communicates with a Supabase backend for data storage.

## Project Structure
```
scorm-lxp-backend
├── src
│   └── server.js                # Backend logic for the application
├── scorm-packages
│   └── example-course
│       └── index.html           # Test SCORM file or dummy HTML page
├── .env                          # Environment variables for Supabase connection
├── package.json                  # Project configuration and dependencies
└── README.md                     # Documentation for the project
```

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scorm-lxp-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```
   SUPABASE_URL=https://yourproject.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Run the application**
   ```bash
   npm start
   ```
   The backend will be live at `http://localhost:3000`.

## Usage
- Access the test SCORM file at:
  ```
  http://localhost:3000/scorm-packages/example-course/index.html
  ```

- Send POST requests to `http://localhost:3000/api/progress` with JWT in headers to save progress data.

## Local Testing Tips
- Use Postman or your frontend to send progress saves to `/api/progress`.
- Confirm that the SCORM iframe can access `window.API` in the parent.
- Log calls to `LMSInitialize()` and `LMSSetValue()` in pipwerks to verify the flow.

## Deployment
Once tested locally, you can upload the entire folder to Railway. Just ensure to update the base URL in your frontend iframe and fetch calls accordingly.