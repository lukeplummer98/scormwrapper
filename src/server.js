import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = 3000;

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});