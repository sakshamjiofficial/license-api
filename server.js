// ==============================================================================
// Express Server for Local Testing or Docker/VPS Deployment
// Run with: npm start (Port 3000)
// ==============================================================================

import express from 'express';
import verifyHandler from './api/verify.js';
import activateHandler from './api/activate.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/verify', (req, res) => {
    verifyHandler(req, res);
});

app.get('/api/activate', (req, res) => {
    activateHandler(req, res);
});

app.get('/', (req, res) => {
    res.send("<h3>Automatic License Server is Running.</h3>");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Verify endpoint: http://localhost:${PORT}/api/verify?device_id=test_device`);
    console.log(`Activate endpoint: http://localhost:${PORT}/api/activate?device_id=test_device`);
});
