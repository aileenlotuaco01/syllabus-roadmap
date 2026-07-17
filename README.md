# Syllabus Roadmap

Syllabus Roadmap is a student planning tool that turns a course syllabus into a
clear weekly roadmap. It uses OpenAI to identify schedule items while keeping
the API key on a secure server rather than exposing it in this public
repository.

## What it does

- Accepts PDF, DOCX, TXT, or pasted syllabus text.
- Extracts supported topics, readings, assignments, exams, and deadlines.
- Shows the exact syllabus evidence behind each extracted item.
- Marks uncertain items for review instead of presenting guesses as facts.
- Creates preparation tasks for supported exams and assignments.
- Downloads the finished plan as an `.ics` calendar file.

## Live app

[Open Syllabus Roadmap on GitHub Pages](https://aileenlotuaco01.github.io/syllabus-roadmap/)

The public interface is hosted on GitHub Pages. Its AI request is processed by
the secure [Sites deployment](https://syllabus-roadmap.aileenlotuaco2.chatgpt.site),
where the OpenAI API key is stored as a private environment variable.

## How to use it

1. Open the live app.
2. Upload a PDF, DOCX, or TXT syllabus, or paste syllabus text.
3. Select the first day of the semester.
4. Choose **Create my roadmap**.
5. Review any amber or uncertain items against the displayed syllabus evidence.
6. Choose **Download Calendar (.ics)** to add the plan to a calendar app.

For a quick demonstration, add `?sample` to the live URL to prefill sample
syllabus text.

## Known limitations

- Scanned PDFs need OCR before the app can read their text.
- File parsing depends on browser-compatible PDF and DOCX libraries loaded from
  public CDNs.
- AI output can be incomplete or uncertain, so students should verify flagged
  items before relying on the calendar.
- The AI feature requires an internet connection and may be temporarily
  unavailable if OpenAI or the secure backend is unavailable.
- Files larger than 20 MB and unsupported file types are rejected.

## Privacy and security

The browser extracts text from the selected file and sends that text to the
secure backend for analysis. The OpenAI API key is never sent to the browser,
committed to Git, or stored in this public repository. Local `.env` files are
excluded by `.gitignore`.

## Project structure

- `index.html` — top-level GitHub Pages entry point.
- `public/style.css` — responsive visual design.
- `public/script.js` — file parsing, roadmap UI, and calendar export.
- `worker/static-site.js` — secure server-side OpenAI integration deployed with
  Sites.
