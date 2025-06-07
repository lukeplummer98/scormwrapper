import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import AdmZip from 'adm-zip';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the SCORM launcher HTML template
const launcherContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCORM Content Launcher</title>
    <style>
        body, html { 
            margin: 0; 
            padding: 0; 
            height: 100%; 
            width: 100%;
            overflow: hidden; 
            background-color: #fff;
            font-family: Arial, sans-serif;
        }
        #scorm-wrapper {
            width: 100%;
            height: 100%;
            position: relative;
        }
        #scorm-container { 
            width: 100%; 
            height: 100%; 
            border: none;
            position: absolute;
            top: 0;
            left: 0; 
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            font-size: 16px;
            color: #333;
        }
    </style>
</head>
<body>
    <div id="scorm-wrapper">
        <div id="loading" class="loading">Loading SCORM content...</div>
        <iframe id="scorm-container" src="" allowfullscreen></iframe>
    </div>
    
    <script>
        // Get URL parameters to determine which SCORM content to load
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId') || 'test-user';
        const courseId = window.location.pathname.split('/')[2] || 'unknown';
        
        // Find the SCORM entry point
        async function findScormEntry() {
            // Common SCORM entry file names
            const possibleEntries = [
                'index.html',
                'index_lms.html',
                'story.html',
                'launch.html',
                'scormdriver/indexAPI.html',
                'shared/launchpage.html'
            ];
            
            // Try each possible entry point
            for (const entry of possibleEntries) {
                try {
                    const response = await fetch(entry, { method: 'HEAD' });
                    if (response.ok) {
                        return entry;
                    }
                } catch (error) {
                    console.log("Entry not found:", entry);
                }
            }
            
            // This part can cause problems in some browsers, so we'll handle it more safely
            try {
                try {
                    const response = await fetch('./');
                    if (response.ok) {
                        const text = await response.text();
                        // Use vanilla JS to find html files instead of DOMParser which can cause issues
                        const htmlRegex = /href=['"](.*?\.html)['"]/g;
                        let match;
                        while ((match = htmlRegex.exec(text)) !== null) {
                            const htmlFile = match[1].split('/').pop();
                            if (htmlFile) {
                                return htmlFile;
                            }
                        }
                    }
                } catch (parseError) {
                    console.error("Error parsing directory listing:", parseError);
                }
            } catch (error) {
                console.error("Error searching directory:", error);
            }
            
            // Default to index.html if nothing else found
            return 'index.html';
        }
        
        // SCORM API implementation
        const API = {
            LMSInitialize: function() {
                console.log('✅ SCORM API initialized');
                try {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'SCORM_INITIALIZE',
                            courseId: courseId
                        }, '*');
                    }
                } catch (e) {
                    console.error('Error in LMSInitialize:', e);
                }
                return "true";
            },
            LMSFinish: function() {
                console.log('SCORM session finished');
                try {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'SCORM_FINISH',
                            courseId: courseId
                        }, '*');
                    }
                } catch (e) {
                    console.error('Error in LMSFinish:', e);
                }
                return "true";
            },
            LMSGetValue: function(parameter) {
                console.log('LMSGetValue called with:', parameter);
                return "";
            },
            LMSSetValue: function(parameter, value) {
                console.log('SCORM data:', parameter, value);
                
                // Save progress data to backend
                const progressData = {};
                progressData[parameter] = value;
                
                fetch('/api/progress', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: userId,
                        courseId: courseId,
                        progressData: progressData
                    })
                }).catch(err => console.error('Error saving progress:', err));
                
                return "true";
            },
            LMSCommit: function() {
                console.log('LMSCommit called');
                return "true";
            },
            LMSGetLastError: function() {
                return "0";
            },
            LMSGetErrorString: function(errorCode) {
                return "No error";
            },
            LMSGetDiagnostic: function(errorCode) {
                return "No diagnostic information";
            }
        };
        
        // SCORM 2004 API implementation
        const API_1484_11 = {
            Initialize: function() {
                return API.LMSInitialize();
            },
            Terminate: function() {
                return API.LMSFinish();
            },
            GetValue: function(parameter) {
                return API.LMSGetValue(parameter);
            },
            SetValue: function(parameter, value) {
                return API.LMSSetValue(parameter, value);
            },
            Commit: function() {
                return API.LMSCommit();
            },
            GetLastError: function() {
                return API.LMSGetLastError();
            },
            GetErrorString: function(errorCode) {
                return API.LMSGetErrorString(errorCode);
            },
            GetDiagnostic: function(errorCode) {
                return API.LMSGetDiagnostic(errorCode);
            }
        };
        
        // Make API available globally
        window.API = API;
        window.API_1484_11 = API_1484_11;

        // Handle iframe load event
        function hideLoader() {
            document.getElementById('loading').style.display = 'none';
            console.log('✅ SCORM content iframe loaded successfully');
        }
        
        // Initialize the SCORM content
        (async function() {
            try {
                const entryPoint = await findScormEntry();
                if (entryPoint) {
                    console.log('Loading SCORM content from:', entryPoint);
                    const iframe = document.getElementById('scorm-container');
                    iframe.onload = hideLoader;
                    iframe.src = entryPoint;
                } else {
                    document.getElementById('loading').style.display = 'none';
                    document.body.innerHTML = '<h2>Error: Could not find SCORM content entry point</h2>';
                }
            } catch (error) {
                document.getElementById('loading').style.display = 'none';
                console.error('Error initializing SCORM content:', error);
                document.body.innerHTML = '<h2>Error loading SCORM content</h2><p>' + error.message + '</p>';
            }
        })();
    </script>
</body>
</html>`;

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'temp-uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Create temp directory if it doesn't exist
if (!fs.existsSync('temp-uploads')) {
  fs.mkdirSync('temp-uploads');
}
if (!fs.existsSync('scorm-packages')) {
  fs.mkdirSync('scorm-packages');
}

// In-memory progress store (add near the top, after app setup)
const progressStore = {};

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Custom headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
  res.removeHeader('X-Powered-By');
  next();
});

// CORS
app.use(cors({
  origin: '*', // Change to your frontend domain in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: false
}));

// Serve only SCORM packages
app.use('/scorm-packages', express.static('scorm-packages'));

// Make Supabase optional, only initialize if environment variables are present
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase initialized successfully');
} else {
  console.log('Supabase environment variables not found, using in-memory storage only');
}

// API endpoint to handle SCORM progress
app.post('/api/progress', (req, res) => {
    const { userId, courseId, progressData } = req.body;

    if (!userId || !courseId || !progressData) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!progressStore[userId]) progressStore[userId] = {};
    // Merge new progressData with existing progress
    const existing = progressStore[userId][courseId]?.progress || {};
    progressStore[userId][courseId] = {
        progress: { ...existing, ...progressData },
        updated_at: new Date().toISOString()
    };

    res.status(200).json({ message: 'Progress saved successfully' });
});

// Get progress (GET)
app.get('/api/progress/:userId/:courseId', (req, res) => {
    const { userId, courseId } = req.params;
    const userProgress = progressStore[userId]?.[courseId];

    if (userProgress) {
        res.json([{
            user_id: userId,
            course_id: courseId,
            progress: userProgress.progress,
            updated_at: userProgress.updated_at
        }]);
    } else {
        res.json([]); // No progress yet
    }
});

// Add API endpoint for SCORM package uploads
app.post('/api/upload-scorm', upload.single('scormPackage'), async (req, res) => {
  try {
    console.log('Upload received:', req.file?.originalname);
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { courseName, courseId } = req.body;
    console.log('Course info:', { courseName, courseId });
    
    if (!courseName || !courseId) {
      console.log('Missing course info');
      return res.status(400).json({ error: 'Course name and ID are required' });
    }
    
    // Create directories with better error handling
    const courseDir = path.join('scorm-packages', courseId);
    console.log('Course directory:', courseDir);
    
    try {
      if (!fs.existsSync('scorm-packages')) {
        fs.mkdirSync('scorm-packages', { recursive: true });
      }
      
      if (fs.existsSync(courseDir)) {
        // Clean up existing files
        const files = fs.readdirSync(courseDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(courseDir, file));
          } catch (err) {
            console.error('Error cleaning file:', file, err);
          }
        }
      } else {
        fs.mkdirSync(courseDir, { recursive: true });
      }
    } catch (err) {
      console.error('Error with directory operations:', err);
      return res.status(500).json({ error: 'Failed to create course directory' });
    }
    
    // Extract zip with better handling
    try {
      console.log('Extracting zip file:', req.file.path);
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(courseDir, true);
    } catch (err) {
      console.error('Error extracting zip:', err);
      return res.status(500).json({ error: 'Failed to extract SCORM package' });
    }
    
    // Create launcher file
    try {
      console.log('Creating launcher file');
      fs.writeFileSync(path.join(courseDir, 'scorm-launcher.html'), launcherContent);
    } catch (err) {
      console.error('Error creating launcher file:', err);
      return res.status(500).json({ error: 'Failed to create launcher file' });
    }
    
    // Clean up with better handling
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (err) {
      console.error('Error cleaning up temp file:', err);
      // Continue anyway since the main operation succeeded
    }
    
    console.log('Upload completed successfully');
    res.status(200).json({ 
      message: 'SCORM package uploaded and processed successfully',
      courseId: courseId,
      launchUrl: `/scorm-packages/${courseId}/scorm-launcher.html`
    });
  } catch (error) {
    console.error('Error processing SCORM package:', error);
    res.status(500).json({ error: 'Failed to process SCORM package', details: error.message });
  }
});

// Add API endpoint to list available courses
app.get('/api/courses', (req, res) => {
  try {
    if (!fs.existsSync('scorm-packages')) {
      return res.json([]);
    }
    
    const courses = fs.readdirSync('scorm-packages')
      .filter(dir => fs.statSync(path.join('scorm-packages', dir)).isDirectory())
      .map(courseId => {
        let courseName = courseId;
        
        // Try to read a course name from metadata if available
        try {
          const metaPath = path.join('scorm-packages', courseId, 'meta.xml');
          if (fs.existsSync(metaPath)) {
            const metaContent = fs.readFileSync(metaPath, 'utf8');
            const titleMatch = metaContent.match(/<title>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
              courseName = titleMatch[1];
            }
          }
        } catch (err) {
          console.log('No metadata found for course:', courseId);
        }
        
        return {
          id: courseId,
          name: courseName,
          launchUrl: `/scorm-packages/${courseId}/scorm-launcher.html`
        };
      });
    
    res.json(courses);
  } catch (error) {
    console.error('Error listing courses:', error);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

// Add endpoint to check if a course exists
app.get('/api/courses/:courseId/exists', (req, res) => {
  try {
    const courseId = req.params.courseId;
    const courseDir = path.join('scorm-packages', courseId);
    
    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }
    
    const exists = fs.existsSync(courseDir) && fs.statSync(courseDir).isDirectory();
    
    res.json({
      courseId,
      exists,
      launchUrl: exists ? `/scorm-packages/${courseId}/scorm-launcher.html` : null
    });
  } catch (error) {
    console.error('Error checking course existence:', error);
    res.status(500).json({ error: 'Failed to check course existence' });
  }
});

// Add a simple home page at the root URL
app.get('/', (req, res) => {
  // Get list of available courses
  let coursesList = '';
  try {
    if (fs.existsSync('scorm-packages')) {
      const courses = fs.readdirSync('scorm-packages')
        .filter(dir => fs.existsSync(path.join('scorm-packages', dir)) && 
                       fs.statSync(path.join('scorm-packages', dir)).isDirectory());
      
      if (courses.length > 0) {
        coursesList = courses.map(course => 
          `<li><a href="/scorm-packages/${course}/scorm-launcher.html" target="_blank">${course}</a></li>`
        ).join('');
      } else {
        coursesList = '<li>No courses available</li>';
      }
    }
  } catch (error) {
    coursesList = `<li>Error listing courses: ${error.message}</li>`;
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SCORM LXP Backend</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; }
        .endpoint { background: #f5f5f5; padding: 8px; border-radius: 4px; font-family: monospace; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>SCORM LXP Backend</h1>
      <p>API Endpoints:</p>
      <ul>
        <li><span class="endpoint">POST /api/progress</span> - Save progress data</li>
        <li><span class="endpoint">GET /api/progress/:userId/:courseId</span> - Get progress for specific user and course</li>
        <li><span class="endpoint">POST /api/upload-scorm</span> - Upload and process SCORM package</li>
        <li><span class="endpoint">GET /api/courses</span> - List available courses</li>
        <li><span class="endpoint">GET /api/courses/:courseId/exists</span> - Check if a course exists</li>
      </ul>
      <h2>Available SCORM courses:</h2>
      <ul>
        ${coursesList}
      </ul>
    </body>
    </html>
  `);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});