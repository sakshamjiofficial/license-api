# Automatic Device Activation Server (Option 1 - Vercel & Node.js)

This server powers the automatic, zero-input license verification system.

## Project Structure

```
server/
├── api/
│   ├── verify.js      # Queried by Android app in onResume()
│   └── activate.js    # Opened in browser when user visits link
├── package.json
├── server.js          # Express wrapper for local testing
└── README.md
```

## How It Works

1. **Android App Check (`/api/verify`)**
   * App requests: `GET /api/verify?device_id=<UUID>`
   * If active: Returns `{"isValid": true, "expiresAt": <timestamp>}`
   * If inactive: Returns `{"isValid": false, "renewalUrl": "https://.../api/activate?device_id=<UUID>"}`

2. **Web Activation (`/api/activate`)**
   * User visits the `renewalUrl` in their browser.
   * Server marks `<UUID>` as activated for 24 hours.
   * Displays confirmation web page advising the user to return to the app.

3. **Automatic Unlock on Return**
   * When user switches back to the Android app, `onResume()` automatically re-queries `/api/verify`.
   * Server returns `{"isValid": true}` and app unlocks without user typing.

## Deploying to Vercel

1. Push this `server/` directory to GitHub (or drag and drop into Vercel dashboard).
2. Vercel automatically deploys the `/api` directory as Serverless Functions.
3. Your endpoints become:
   * `https://your-project.vercel.app/api/verify`
   * `https://your-project.vercel.app/api/activate`

## Local Testing

```bash
cd server
npm install
npm start
```
Test with curl or browser:
* Check status: `http://localhost:3000/api/verify?device_id=phone1` (returns `isValid: false`)
* Activate device: `http://localhost:3000/api/activate?device_id=phone1` (activates)
* Re-check status: `http://localhost:3000/api/verify?device_id=phone1` (now returns `isValid: true`)
