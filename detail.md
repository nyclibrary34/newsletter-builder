# Newsletter Builder: Detailed Architecture and Workflow

This document explains what this application does, how it is structured, and how the major pieces work together at runtime.

The app is a Flask-based newsletter editing and export system built around a browser editor. Its main purpose is to let users upload newsletter HTML files, edit them visually, save them back to storage, and export email-friendly HTML. It also includes supporting tools for image adjustment and HTML-to-PDF conversion.

## 1. What the App Does

At a high level, the app provides three user-facing capabilities:

1. Newsletter management
   Users can upload an existing `.html` newsletter, browse previously stored newsletters, reopen them in the editor, save changes, delete them, and download processed export-ready HTML.

2. Visual newsletter editing
   Users edit newsletters in a GrapesJS-based editor with CKEditor-powered rich text editing, custom content blocks, autosave, and export actions.

3. Utility tools
   The app includes an image adjustment tool and an HTML-to-PDF converter for adjacent publishing workflows.

The core value of the app is not just storing HTML. It tries to convert messy newsletter HTML into something more stable for email delivery by normalizing markup, inline styles, and email-compatibility details during export.

## 2. High-Level Architecture

The application is split into four main layers:

1. Flask application and routing
   The backend receives requests, renders templates, loads/saves newsletter files, and exposes tool endpoints.

2. Storage abstraction
   Newsletter files can be stored either locally under `static/files/...` or remotely through Cloudinary. The rest of the app talks to a `StorageManager` instead of hard-coding storage behavior.

3. Browser-based editor and client logic
   The actual newsletter editing experience lives mostly in the browser. GrapesJS, CKEditor, the filename manager, and the export HTML processor all run client-side.

4. Focused backend services
   Some tasks are server-side because they need file handling or external services. The main example is the PDF service that renders HTML to a single-page PDF through Browserless.

## 3. Repository Structure

These are the key folders and files:

`api/index.py`
Flask app factory entrypoint used by Vercel and local/server deployment.

`app/config/settings.py`
Configuration classes, environment loading, and startup validation.

`app/services/pdf.py`
Service that converts HTML into a single-page PDF using Browserless and Pillow.

`routes/main.py`
Top-level routes such as `/` and tool preview pages.

`routes/newsletter.py`
Newsletter CRUD and editor-related endpoints.

`routes/tools.py`
Image and PDF utility endpoints.

`utils/storage.py`
Storage abstraction for local filesystem and Cloudinary.

`templates/base.html`
Shared application shell with sidebar layout and external UI libraries.

`templates/upload.html`
Upload page and newsletter listing UI.

`templates/editor.html`
Main GrapesJS editor page and most editing/export client logic.

`templates/image_adjustment.html`
Large client-side image enhancement workflow.

`static/js/html-processor.js`
The export normalizer that rewrites generated HTML for email compatibility.

`static/js/filename-manager.js`
Client-side helper for editable filename handling in the UI.

`vercel.json`
Routes all traffic into the Flask app entrypoint.

## 4. Runtime Boot Sequence

The app starts in `api/index.py` through `create_app()`.

Startup flow:

1. Flask app is created.
2. Configuration is loaded from `app.config.settings.get_config()`.
3. `Config.init_app(app)` runs validation and setup checks.
4. Optional integrations are initialized.
   If Sentry is enabled, `init_sentry(app)` is called.
   If `STORAGE_TYPE=cloudinary`, Cloudinary credentials are applied.
5. Blueprints are registered.
   `main_bp`
   `newsletter_bp`
   `tools_bp` under `/tools`
6. Common headers and Jinja helpers are attached.
   Security headers are added in an `after_request` hook.
   A `format_datetime` template filter is registered.
7. `/health` is exposed for operational checks.

On Vercel, `vercel.json` maps every request to `api/index.py`, so Flask is the only server entrypoint.

## 5. Configuration Model

The app reads environment variables through `python-dotenv` and `app/config/settings.py`.

The most important settings are:

`STORAGE_TYPE`
Controls whether newsletter files are stored locally or in Cloudinary.

`UPLOAD_FOLDER`
Base folder used by the local storage implementation.

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
Required when cloud storage is enabled.

`BROWSERLESS_TOKEN`
Required for the current PDF conversion path.

`SECRET_KEY`
Flask session/security setting.

There are separate config classes for development, production, and testing. The config layer also performs early validation. For example, if Cloudinary storage is selected and the required Cloudinary credentials are missing, startup fails instead of allowing broken runtime behavior later.

## 6. Main Navigation and UI Shell

The shared page layout is defined in `templates/base.html`.

This template provides:

1. A fixed sidebar with links to:
   Newsletter Builder
   Image Adjustment
   HTML to PDF

2. The global UI dependencies:
   Bootstrap
   Google Fonts
   Material Icons
   Bootstrap Icons
   SweetAlert2

3. The responsive layout behavior
   Desktop uses a fixed left sidebar.
   Mobile uses a toggleable slide-in sidebar.

Every main template extends `base.html`, so the app feels like one tool suite rather than disconnected pages.

## 7. Newsletter Upload and Listing Flow

The newsletter landing flow is handled primarily by `routes/newsletter.py` and `templates/upload.html`.

### 7.1 Route behavior

Important newsletter routes:

`/`
Redirects to the upload page.

`/newsletter-upload` GET
Renders the upload/listing interface.

`/newsletter-upload` POST
Accepts uploaded newsletter HTML files.

`/edit/<path:file_id>`
Opens a stored newsletter inside the visual editor.

`/content/<path:file_id>`
Returns the stored HTML content so the editor or download flow can load it.

`/save/<path:file_id>`
Writes edited HTML back to storage.

`/download/<path:file_id>`
Downloads the raw stored file.

`/delete/<path:file_id>`
Deletes the newsletter from storage.

### 7.2 What happens during upload

When a user uploads an HTML file:

1. The request hits `newsletter.upload`.
2. The file is handed to `StorageManager`.
3. The storage layer chooses the correct backend.
4. The file is saved into a newsletter path organized by year and month.

The storage path pattern is effectively:

`newsletters/<year>/<month>/<filename>.html`

That organization matters because the UI groups and persists newsletters as stored artifacts rather than rows in a database.

### 7.3 What the upload page does in the browser

`templates/upload.html` is more than a plain form. It also:

1. Lists existing newsletters.
2. Uses `filename-manager.js` so the user can adjust output names client-side.
3. Lets the user open, delete, or download items.
4. Uses `html-processor.js` to process newsletters before download, even when the user downloads from the listing page rather than from the editor.

That last point is important. The app separates:

1. Raw stored HTML
2. Export-ready email HTML

The stored source is not always the exact same as the downloaded export.

## 8. Storage Layer

The storage abstraction lives in `utils/storage.py`.

### 8.1 Why it exists

The app needs one consistent interface for:

1. Uploading files
2. Reading file content
3. Listing newsletters
4. Deleting files
5. Returning URLs for assets

That behavior should not depend on whether the project is deployed with local disk access or Cloudinary.

### 8.2 Main classes

`StorageInterface`
Defines the expected storage behavior.

`LocalStorage`
Stores files in the app directory under `static/files/...`.

`CloudinaryStorage`
Stores and retrieves files using Cloudinary APIs.

`StorageManager`
Acts as the adapter used by the rest of the application.

### 8.3 Local storage behavior

Local storage is simple:

1. Files are written to the filesystem.
2. The app serves them through Flask static URLs.
3. `get_file_url()` maps a stored file ID to something like `url_for('static', filename=f"files/{file_id}")`.

### 8.4 Cloudinary behavior

Cloudinary storage handles:

1. Uploading newsletter HTML files
2. Listing stored resources
3. Destroying files
4. Resolving URLs

This allows deployment into serverless environments where persistent local disk should not be treated as durable storage.

### 8.5 Path normalization and backward compatibility

The storage layer includes `_build_storage_candidate_paths`, which suggests the app has to tolerate more than one historical path style. That is a practical compatibility layer so older newsletters can still be found after path conventions changed.

### 8.6 Listing cache

`StorageManager` caches file listings with a TTL and an `RLock`.

That cache exists because listing storage contents can be relatively expensive, especially with a remote provider. Cache invalidation happens after upload, delete, and save operations so the UI stays current.

## 9. Newsletter Editing Flow

The editing experience is centered in `templates/editor.html`.

This is the most important part of the product.

### 9.1 Editor initialization

When a user opens `/edit/<file_id>`:

1. Flask renders `editor.html`.
2. The page loads GrapesJS and the newsletter preset.
3. The page loads `html-processor.js`.
4. The editor waits for readiness.
5. It fetches the stored HTML from `/content/<file_id>`.
6. The code extracts the `<body>` markup and embedded `<style>` content.
7. GrapesJS receives the body as components and the styles as editor CSS.

That means the editor is not building newsletters from a database schema. It is reconstructing the editing state from actual HTML.

### 9.2 Rich text editing

The editor uses the GrapesJS CKEditor plugin. This gives text blocks a richer editing experience than basic contenteditable behavior.

The integration includes custom RTE enable/disable logic so inline editing works predictably inside GrapesJS components.

### 9.3 Paste cleanup

The editor contains `sanitizePastedHtml`, which is meant to clean pasted content, especially content from Microsoft Word or other HTML-heavy sources.

This matters because pasted content is one of the biggest sources of:

1. Random inline font changes
2. Unwanted `mso-` styles
3. Bad spacing
4. Extra spans and wrapper tags

This cleanup reduces problems before export normalization even starts.

### 9.4 Custom content blocks

The editor defines reusable content blocks beyond the standard newsletter preset.

Examples include:

`image-caption-block`
`image-left-text-block`
`image-right-text-block`
`bullet-list-block`
`text-divider-block`

These blocks help authors create newsletter sections without manually composing table-heavy email markup every time.

### 9.5 Editor-specific styling

The page injects custom styles for those blocks inside the editing canvas. This is separate from final export normalization. The editor needs visual guidance and edit affordances that may not belong in the final email HTML.

## 10. Save and Autosave Model

The editor page contains several client-side save helpers:

`buildSavePayload()`
Builds the HTML payload that should be persisted.

`performSave()`
Sends the save request to the backend.

`scheduleAutosave()`
Schedules a delayed save after changes.

`triggerAutosave()`
Triggers the autosave flow.

`initializeAutosaveBaseline()`
Captures the initial document state so the app knows whether changes occurred.

### 10.1 How save works

The save path is different from export:

1. Save is about persisting the current editable document state.
2. Export is about generating a distribution-ready email file.

On save:

1. The browser gathers current HTML/CSS from GrapesJS.
2. It packages the content.
3. It sends the result to `/save/<file_id>`.
4. The backend stores the updated HTML through `StorageManager`.

Autosave exists so the editor behaves more like a document tool and less like a manual file transformer.

## 11. Export Pipeline

The export pipeline is one of the most important design decisions in the app.

The app does not simply take `editor.getHtml()` and download it as-is. It performs a normalization step through `static/js/html-processor.js`.

### 11.1 Export command flow

In the editor:

1. The user clicks export.
2. The editor collects HTML and CSS from GrapesJS.
3. `sanitizeCssForEmail(css)` removes or rewrites CSS that is likely to behave poorly in email clients.
4. `ensureAlignmentStyles(html)` fills in alignment-related styles that email layouts often require.
5. The page injects critical CSS needed by some visual elements.
6. The full HTML document is assembled.
7. The result is formatted.
8. `window.HTMLProcessor.processAndDownload(...)` does the final rewrite and browser download.

The upload page uses the same processor when downloading existing newsletters, which keeps export behavior consistent across the app.

### 11.2 What `html-processor.js` is responsible for

This file parses the HTML and makes email-oriented corrections such as:

1. Fixing document structure and head/meta tags
2. Inlining CSS rules from `<style>` tags into elements
3. Removing `<style>` tags after inlining
4. Rewriting unstable or auto-generated IDs
5. Converting problematic values for better email compatibility
6. Normalizing image and alignment behavior
7. Applying email-safe body and table-cell defaults
8. Formatting the final HTML before download

### 11.3 Why export normalization exists

HTML that looks acceptable in a browser editor can still render badly in:

1. Outlook
2. Gmail
3. Apple Mail
4. Mobile email clients

Email HTML is much stricter than browser HTML. The export processor is the place where the app translates editor-friendly HTML into email-friendly HTML.

### 11.4 Typography normalization

The processor also deals with typography consistency problems caused by nested spans, pasted content, and editor-generated inline styles.

The current implementation includes logic to:

1. Mark editable cells before final normalization
2. Apply baseline text-block typography
3. Strip conflicting inline `font-family`, `font-size`, and `line-height` values from nested inline wrappers

That behavior is specifically important for the class of issue where two paragraphs look identical in the editor but render differently in the final email because one contains hidden inline style remnants from pasted or legacy markup.

## 12. Email Compatibility Strategy

This app is effectively an email HTML post-processor as much as it is a page editor.

The compatibility strategy includes:

1. Preferring inline styles over stylesheet-only declarations
2. Removing CSS that email clients often ignore or distort
3. Making table/cell alignment explicit
4. Cleaning up inconsistent typography
5. Preserving links and semantic emphasis while removing style conflicts

This explains why the export path is opinionated. It is not a generic HTML serializer. It is a cleanup and compatibility layer for newsletter delivery.

## 13. Filename Management

`static/js/filename-manager.js` handles filename editing and persistence in the browser.

Its responsibilities include:

1. Normalizing file extensions
2. Validating user-entered names
3. Sanitizing unsafe filename characters
4. Persisting filename choices in browser storage
5. Updating the UI without requiring a server round trip

It stores its state under a browser storage key similar to:

`newsletter:filenames:v1`

This is a convenience layer. The storage backend still controls the underlying file record, but the UI can preserve user naming preferences across sessions.

## 14. Image Adjustment Tool

The image tool is exposed through `/tools/image-adjustment` and rendered by `templates/image_adjustment.html`.

### 14.1 Architectural note

This tool is unusual because a large amount of its behavior is client-side. The page contains extensive JavaScript for:

1. Multi-image uploads
2. Canvas-based previewing
3. Histogram-based auto-enhancement
4. Manual adjustment controls
5. Batch operations
6. Compression targeting
7. Downloading processed images

The server routes in `routes/tools.py` provide simpler endpoint-based operations, but the page itself already contains a substantial in-browser processing workflow.

### 14.2 Backend endpoints

`/tools/image-info`
Returns capability and limit information.

`/tools/adjust-image`
Applies brightness, contrast, saturation, and sharpness changes using Pillow.

`/tools/resize-image`
Resizes an image, optionally preserving aspect ratio.

### 14.3 Frontend behavior

The page tracks an image queue, processed images, and current image selection. It uses canvas operations and compresses output aggressively enough to reduce size while preserving useful quality.

The client-side code is large because the page aims to feel interactive, with previews and batch controls, instead of behaving like a plain file upload form.

## 15. HTML-to-PDF Tool

The PDF flow is exposed through:

`/tool-preview/html-to-pdf`
UI page

`/tools/convert/html-to-pdf`
Backend conversion endpoint

### 15.1 User flow

1. The user opens the HTML-to-PDF tool preview page.
2. The browser uploads an HTML file.
3. Flask receives the file and validates that it is actually HTML.
4. The HTML content is passed into `PDFService.generate_single_page_pdf(...)`.
5. The service returns PDF bytes.
6. Flask writes them to a temporary file and streams the file back as a download.

### 15.2 Why the PDF service is separate

Generating a visually accurate PDF from HTML is more complex than storing or editing HTML. The app isolates that behavior in `app/services/pdf.py`.

### 15.3 How the current PDF implementation works

The current production path relies on Browserless.

The service:

1. Injects CSS intended to force a single-page rendering strategy
2. Sends the HTML to Browserless for rendering
3. Captures the result as an image
4. Composes that image into a single-page PDF

This image-first composition model matters because it avoids browser pagination problems. Instead of asking a headless browser to produce a multi-page PDF and hoping pagination works, the service renders the newsletter into one long visual snapshot and then places that snapshot into a single-page PDF canvas.

### 15.4 Playwright note

The codebase still contains traces of Playwright-based logic, but the active production implementation is Browserless-focused. That matches the deployment requirements in `api/requirements.txt`, which explicitly note that Playwright was removed for serverless compatibility.

## 16. Main Routes and Responsibilities

### 16.1 `routes/main.py`

Purpose:

1. Redirect the root route to the newsletter upload page
2. Render generic tool preview pages such as HTML-to-PDF

This file is intentionally thin.

### 16.2 `routes/newsletter.py`

Purpose:

1. Accept newsletter uploads
2. Render the upload/list page
3. Render the editor page
4. Return raw newsletter content
5. Save newsletter changes
6. Delete newsletters
7. Download stored files

This is the main product workflow controller.

### 16.3 `routes/tools.py`

Purpose:

1. Render the image adjustment page
2. Process image operations
3. Process HTML-to-PDF conversion

This route file mostly validates input, calls focused logic, and returns files or JSON responses.

## 17. Data Flow Through the App

### 17.1 Upload to edit to save

1. User uploads newsletter HTML
2. Backend stores file via `StorageManager`
3. User opens editor
4. Browser fetches stored HTML from `/content/<file_id>`
5. GrapesJS reconstructs the editable document
6. User modifies content
7. Browser autosaves or manually saves via `/save/<file_id>`
8. Backend overwrites stored source HTML

### 17.2 Edit to export

1. User edits newsletter in GrapesJS
2. Browser collects HTML and CSS
3. Browser sanitizes CSS for email
4. Browser ensures alignment rules
5. Browser builds a full HTML document
6. `HTMLProcessor` normalizes and inlines styles
7. Browser downloads processed export HTML

### 17.3 Upload page direct download

1. User clicks download on an existing newsletter card
2. Browser fetches stored HTML
3. `HTMLProcessor` rewrites it
4. Browser downloads the processed version

That means the export normalization logic is shared across different entry points.

## 18. Why the App Uses HTML as the Source of Truth

The app does not appear to use a database-backed newsletter model with structured blocks stored as rows or JSON schema. Instead, the practical source of truth is the HTML document itself.

That has advantages:

1. Easy import of preexisting newsletters
2. Easy portability
3. Simpler persistence model
4. Less server-side modeling complexity

It also has tradeoffs:

1. HTML cleanup becomes very important
2. Pasted content can introduce invisible formatting issues
3. Editor reconstruction must parse real HTML
4. Export normalization becomes a core feature rather than an optional step

This design explains a lot of the codebase shape.

## 19. Deployment Model

Deployment is designed around Vercel serverless Python.

Evidence for that includes:

1. `vercel.json` routing every request to `api/index.py`
2. `runtime.txt` pinning Python 3.11
3. `api/requirements.txt` containing the production dependency set
4. Removal of Playwright in favor of Browserless for serverless compatibility

### 19.1 Practical deployment consequences

1. Local filesystem storage may be fine for local development but is not ideal as a durable production persistence strategy on serverless infrastructure.
2. Cloudinary exists as the production-friendly storage option.
3. PDF generation is delegated to Browserless rather than depending on a heavy local browser runtime.

## 20. External Dependencies

Backend dependencies in `api/requirements.txt` include:

`Flask`
HTTP server and templating framework.

`cloudinary`
Remote file storage provider integration.

`python-dotenv`
Environment loading.

`requests`
External HTTP calls, including Browserless interactions.

`pillow`
Image processing and PDF/image composition support.

`Flask-Compress`
Response compression.

Client-side dependencies include:

1. GrapesJS
2. `grapesjs-preset-newsletter`
3. `grapesjs-plugin-ckeditor`
4. CKEditor
5. Bootstrap
6. SweetAlert2

## 21. Operational Constraints and Design Tradeoffs

### 21.1 The editor is browser-heavy by design

A large amount of behavior is intentionally client-side:

1. GrapesJS rendering
2. Rich text editing
3. Autosave coordination
4. Export HTML processing
5. Filename management
6. Much of image enhancement

That keeps the backend simpler, but it also means the browser side is the real execution environment for many important features.

### 21.2 Export correctness matters more than raw editor fidelity

Because the output is email HTML, the export stage has to be opinionated. If the export processor did nothing, the output would be more faithful to the raw editor DOM but less reliable in real email clients.

### 21.3 Stored HTML and exported HTML are intentionally different artifacts

This is one of the most important conceptual points in the app:

1. Stored HTML is the editable working version.
2. Exported HTML is the distribution version after compatibility processing.

If you treat those as the same thing, much of the code can look redundant. It is not redundant. It reflects two different jobs.

### 21.4 The system is tolerant of messy source content

Because users can upload existing newsletters and paste formatted content, the app has to compensate for inconsistent input. The combination of paste sanitization and export normalization is a direct response to that reality.

## 22. How to Reason About Changes in This Codebase

If you need to modify or debug the app, it helps to classify the issue first.

### 22.1 If the problem is storage-related

Check:

1. `utils/storage.py`
2. Config values in `app/config/settings.py`
3. The upload/save/delete routes in `routes/newsletter.py`

### 22.2 If the problem is editor rendering or content behavior

Check:

1. `templates/editor.html`
2. GrapesJS block definitions
3. Paste sanitization logic
4. Save payload generation

### 22.3 If the problem only appears in exported email HTML

Check:

1. `templates/editor.html` export assembly
2. `static/js/html-processor.js`
3. Any hidden inline styles in imported or pasted markup

### 22.4 If the problem is PDF generation

Check:

1. `routes/tools.py`
2. `app/services/pdf.py`
3. `BROWSERLESS_TOKEN`
4. Browserless request/response behavior

### 22.5 If the problem is deployment-specific

Check:

1. `vercel.json`
2. `runtime.txt`
3. `api/requirements.txt`
4. Storage backend assumptions

## 23. End-to-End Summary

The app is a Flask-hosted, browser-heavy newsletter production system.

Its backend is responsible for:

1. Routing
2. Configuration
3. Storage access
4. File save/load/delete operations
5. Tool endpoints
6. PDF generation

Its frontend is responsible for:

1. Visual newsletter editing
2. Rich text editing
3. Block-based composition
4. Autosave coordination
5. Filename handling
6. HTML export normalization
7. Much of the image enhancement experience

The key architectural idea is this:

The app treats the editable newsletter and the final exported email as related but different products. The stored source remains flexible for editing, while the exported version is normalized aggressively for email-client reliability.

That distinction is what makes the app work.
