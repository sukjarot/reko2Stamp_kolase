# 📁 Reko2stamp - Project Structure Documentation

## Overview
Reko2stamp has been refactored into a modular architecture with separated concerns for better maintainability and scalability.

---

## 🗂️ New Folder Structure

```
reko2stamp-main/
├── index.html                 # Main HTML file (clean, just references)
├── index-old.html             # Backup of original monolithic HTML
├── manifest.json              # PWA configuration
├── sw.js                       # Service Worker (offline support)
├── README.md                   # Project information
├── SECURITY.md                # Security guidelines
├── icon ultimate.png          # Application icon
│
├── css/
│   └── styles.css             # All styles (extracted from HTML)
│
├── js/
│   ├── app.js                 # Main application logic
│   ├── db.js                  # IndexedDB utilities
│   ├── canvas-utils.js        # Canvas drawing functions
│   ├── camera.js              # Camera functionality
│   ├── location.js            # GPS, location & map functions
│   └── storage.js             # File storage & download utilities
│
└── [Other assets]
    └── (Add images, fonts, etc. as needed)
```

---

## 📝 File Descriptions

### HTML & Entry Point
- **index.html**: Clean entry point that loads all external resources. Contains only structure and references to CSS/JS files.

### Styles
- **css/styles.css**: Contains all CSS styling using CSS variables for theming. Organized by component sections.

### JavaScript Modules

#### 1. **js/db.js** - Database Utilities
Functions for IndexedDB operations:
- `initDB()` - Initialize or get database reference
- `saveSetting(key, value)` - Save user settings
- `loadSetting(key)` - Load user settings

**Used By:** storage.js, app.js

#### 2. **js/canvas-utils.js** - Canvas & Drawing Functions
Utility functions for canvas operations:
- `getSourceWidth()`, `getSourceHeight()` - Get image dimensions
- `buildStampText()` - Create stamp text from date/location
- `wrapText()` - Render multi-line text
- `getTextBoundingBox()` - Calculate text bounds
- `isPointInTextArea()` - Check if click is on text
- `getHitRegion()` - Get crop handle region
- `drawCropUI()` - Render crop interface
- `setupHighResCanvas()` - Configure canvas resolution
- `applyCrop()` - Apply crop transformation

**Used By:** app.js

#### 3. **js/camera.js** - Camera Control
Camera functionality:
- `startCamera()` - Open camera stream
- `stopCamera()` - Close camera stream
- `setupCameraEvents()` - Initialize camera button listeners
- `updateVideoStyle()` - Apply rotation/mirror transforms

**Used By:** app.js

#### 4. **js/location.js** - Location & Map
GPS, geocoding, and map features:
- `searchLocation()` - Search locations via LocationIQ API
- `reverseGeocode()` - Get address from coordinates
- `startFollowGPS()`, `stopFollowGPS()` - GPS tracking
- `setupGPSButton()` - Initialize GPS button listeners
- `initLeafletMap()` - Initialize map
- `updateMarkerPosition()` - Update map marker
- `setupMapButton()` - Initialize map button listeners
- `setupLocationInput()` - Initialize location input with autocomplete

**Used By:** app.js

#### 5. **js/storage.js** - File Storage
File saving and download utilities:
- `dataURLToBlob()` - Convert canvas data to blob
- `updateStoragePreview()` - Update filename preview
- `setupStorageModal()` - Initialize storage settings modal
- `savePhoto()` - Save photo to folder or download
- `fallbackDownload()` - Browser download fallback
- `restoreStorageSettings()` - Load saved settings from DB

**Used By:** app.js

#### 6. **js/app.js** - Main Application
Core application logic:
- Event listeners for all controls
- Main render loop and interaction handlers
- Canvas manipulation (pan, zoom, crop, rotate)
- Touch and mouse event handling
- Service Worker registration
- Initialization of all modules

**Imports:** All other JS modules

---

## 🔄 Module Dependencies

```
app.js (Main)
├── db.js (Database)
├── canvas-utils.js (Canvas utilities)
├── camera.js (Camera)
├── location.js (Location/GPS/Map)
└── storage.js (File storage)
    └── db.js (Database)
```

---

## 🚀 Usage Instructions

### Development
1. **Edit HTML**: Modify `index.html` (structure only)
2. **Edit CSS**: Modify `css/styles.css`
3. **Edit JavaScript**: Modify appropriate `js/*.js` file based on feature:
   - UI/Controls → `app.js`
   - Drawing functions → `canvas-utils.js`
   - Camera features → `camera.js`
   - Location features → `location.js`
   - Storage features → `storage.js`
   - Database operations → `db.js`

### Adding New Features
1. Create new JS file in `js/` folder if needed
2. Import it in index.html (before app.js)
3. Expose functions globally if called from HTML (e.g., `adjustSize()`)

### Loading External Libraries
1. Add `<link>` or `<script>` tag in `<head>` section of index.html
2. Reference before app.js loads

---

## 📊 Code Size Comparison

### Before (Monolithic)
- Single `index.html`: 1360 lines
- Hard to navigate and maintain
- All concerns mixed together

### After (Modular)
- `index.html`: ~180 lines (clean structure)
- `css/styles.css`: ~620 lines (all styling)
- `js/app.js`: ~450 lines (main logic)
- `js/canvas-utils.js`: ~280 lines (canvas functions)
- `js/location.js`: ~250 lines (location features)
- `js/storage.js`: ~170 lines (storage features)
- `js/camera.js`: ~100 lines (camera control)
- `js/db.js`: ~40 lines (database utilities)

**Total**: Still same functionality but organized and maintainable!

---

## 🎯 Best Practices for Maintenance

### Following the Structure
1. ✅ Keep HTML clean - only structure
2. ✅ All styling in CSS file
3. ✅ One responsibility per JS file
4. ✅ Use descriptive function names
5. ✅ Add comments for complex logic

### When Modifying
1. Check which module handles the feature
2. Make changes in that module only
3. Update related functions if needed
4. Test in both desktop and mobile views

### Adding Functions
1. Add to appropriate module
2. If used from HTML onclick, make global: `window.functionName = functionName`
3. Update this documentation

---

## 🔧 Common Edits Quick Guide

| Task | File to Edit | What to Change |
|------|-------------|-----------------|
| Change colors/theme | `css/styles.css` | CSS custom properties (`:root`) |
| Edit layout | `index.html` | HTML structure and classes |
| Fix canvas bug | `js/canvas-utils.js` | Drawing functions |
| Add camera feature | `js/camera.js` | Camera event handlers |
| Modify GPS behavior | `js/location.js` | GPS/geocoding functions |
| Change save behavior | `js/storage.js` | Save/download logic |
| Modify UI interactions | `js/app.js` | Event listeners |

---

## 📱 Features Overview

### ✨ Core Features
- ✅ Upload or capture photos
- ✅ Add stamps (date, time, location, notes)
- ✅ Edit stamp text, size, color, opacity
- ✅ Crop and rotate images
- ✅ Pan and zoom canvas
- ✅ Touch and mouse controls

### 🌍 Location Features
- ✅ GPS location detection
- ✅ Location autocomplete search
- ✅ Map picker with Leaflet
- ✅ Continuous GPS tracking option
- ✅ Geocoding (reverse & forward)

### 📸 Camera Features
- ✅ Live camera capture
- ✅ Front/back camera switching
- ✅ Camera rotation adjustment
- ✅ High-resolution capture

### 💾 Storage Features
- ✅ Browser download
- ✅ File system access (Chrome/Edge)
- ✅ Custom folder selection
- ✅ Auto-numbering filenames
- ✅ Settings persistence

### 📲 PWA Features
- ✅ Offline support (Service Worker)
- ✅ Installable (manifest.json)
- ✅ Works as native app

---

## 🐛 Troubleshooting

### Feature not working?
1. Check browser console for errors
2. Verify corresponding JS file exists
3. Check if script is loaded in index.html
4. Test in different browser

### CSS changes not showing?
1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check CSS file path in HTML

### Camera not working?
1. Check browser permissions
2. Verify HTTPS or localhost
3. Try different browser (Chrome/Edge recommended)

---

## 📜 License
See LICENSE file for details

---

## 🤝 Contributing
Follow the modular structure when adding new features.

---

**Last Updated:** April 2026
**Version:** 2.5
