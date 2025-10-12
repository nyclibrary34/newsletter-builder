# Repository Guidelines

## Project Structure & Module Organization
The Flask entrypoint lives in `api/index.py`, which boots the app, registers blueprints from `routes/`, and attaches security headers. Domain settings and storage adapters sit in `app/config/` and `utils/storage.py`; add new services under `app/services/` to keep logic isolated. Templates reside in `templates/`, while static assets (JS, CSS, images) belong in `static/`. Test mirrors for any new module should land in `tests/` using the same path structure, e.g., `tests/routes/test_newsletter.py`.

## Build, Test, and Development Commands
Create your environment with `python -m venv venv` and install dependencies via `pip install -r api/requirements.txt -r requirements-dev.txt`. Run the dev server using `FLASK_ENV=development python api/index.py` for verbose logs at http://localhost:5000. Execute the suite with `pytest` or enforce coverage using `pytest --cov=app`. Before pushing, run `black .`, `isort .`, `flake8`, and `mypy api app routes utils`; `pre-commit run --all-files` wraps them together.

## Coding Style & Naming Conventions
Follow four-space indentation and snake_case for variables and functions; classes use UpperCamelCase. Blueprint modules follow `routes/<feature>.py`, with helper functions prefixed by `_`. Templates align with route names (e.g., `templates/newsletter/editor.html`). Allow `black` and `isort` to handle formatting—avoid manual alignment that will be reformatted.

## Testing Guidelines
Tests live under `tests/` with fixtures in `tests/conftest.py`. Name files after their target modules and add regression coverage around storage and HTML processing hot spots. Use `pytest-mock` to stub external services such as Cloudinary or Browserless. Aim for ≥80% coverage demonstrated via `pytest --cov`.

## Commit & Pull Request Guidelines
Write imperative commits like `Add batch image constraints`, and reference issue IDs in the body when applicable. Ensure PR descriptions explain user impact and include screenshots or HTML snippets for UI/editor updates. Confirm linters and tests run clean locally, update `.env.example` when new settings land, and document any configuration changes in README notes or `AGENTS.md`.

## Configuration & Operations Notes
Never commit `.env`; rely on `.env.example` for new keys. Guard optional integrations (Cloudinary, Browserless, Sentry) with config checks such as `if app.config[...]`. Enable Sentry only in development by setting `ENABLE_SENTRY=true` locally and storing DSNs in secure secret managers.
