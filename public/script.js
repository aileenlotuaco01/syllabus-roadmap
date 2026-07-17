const SAMPLE_SYLLABUS = `Course: Introduction to Modern Japan
Semester: March 3 - June 20
Week 1: Introduction to Japanese history
Week 2: Tokugawa period
Week 3: Meiji Restoration
Week 5: Reading response due
Week 8: Midterm exam
Week 11: Student presentation due
Week 12: Final paper due
Week 14: Final exam`;

const elements = {
  fileInput: document.querySelector("#syllabusFileInput"),
  fileLabel: document.querySelector("#fileLabel"),
  dropZone: document.querySelector(".drop-zone"),
  syllabusInput: document.querySelector("#syllabusInput"),
  semesterStart: document.querySelector("#semesterStart"),
  generateBtn: document.querySelector("#generateBtn"),
  status: document.querySelector("#statusMessage"),
  roadmapSection: document.querySelector("#roadmapSection"),
  roadmapSummary: document.querySelector("#roadmapSummary"),
  roadmap: document.querySelector("#roadmap"),
  downloadBtn: document.querySelector("#downloadCalendarBtn"),
};

let roadmapWeeks = [];
let selectedFile = null;

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeLine(line) {
  return line.replace(/^[-*•]\s*/, "").replace(/\s+/g, " ").trim();
}

function detectType(line) {
  const lower = line.toLowerCase();
  if (/\bexam\b|\bmidterm\b|\btest\b/.test(lower)) return "Exam";
  if (/\btask\s*\d+\b|assignment|paper|response|quiz|due|deadline|submission/.test(lower)) return "Assignment";
  if (/read|chapter|article/.test(lower)) return "Reading";
  if (/review|study|prepare/.test(lower)) return "Review";
  return "Topic";
}

function cleanTitle(line) {
  return normalizeLine(line)
    .replace(/^(week|wk|module|unit)\s*\d{1,2}\s*[:.–—-]?\s*/i, "")
    .replace(/\s+\b(week|wk|module|unit)\s*\d{1,2}\b\s*$/i, "")
    .trim();
}

function parseSyllabus(text) {
  const items = [];
  const seen = new Set();
  let lastWeek = 0;
  let lessonRowActive = false;
  let lessonTopicCaptured = false;
  let lessonScheduleStarted = false;

  text.split(/\n/).map(normalizeLine).filter(Boolean).forEach((line) => {
    if (/^(final grade|course requirements|prerequisites|bibliography|description of the learning product|weight in the final score)\s*:?\s*$/i.test(line)) {
      lessonScheduleStarted = false;
      lessonRowActive = false;
      lessonTopicCaptured = false;
      return;
    }

    if (/^lesson\s*no\.?\s*$/i.test(line)) {
      lessonScheduleStarted = true;
      lessonRowActive = false;
      lessonTopicCaptured = false;
      return;
    }

    const standaloneLessonNumber = line.match(/^(\d{1,2})$/);
    if (standaloneLessonNumber && lessonScheduleStarted) {
      lastWeek = Number(standaloneLessonNumber[1]);
      lessonRowActive = lastWeek >= 1 && lastWeek <= 52;
      lessonTopicCaptured = false;
      return;
    }

    const weekMatch = line.match(/\b(?:week|wk|module|unit|lesson(?:\s+no\.?)?)\s*[:#.-]?\s*(\d{1,2})\b/i);
    let type = detectType(line);
    const isExplicitAssessment = /\btask\s*\d+\b|\bassignment\b|\bquiz\b|\bdue\b|\bdeadline\b|\bsubmission\b|\bexam\b|\bmidterm\b|\btest\b/i.test(line);
    const startsWithWeek = /^(week|wk|module|unit)\s*\d{1,2}/i.test(line);
    const isTableHeader = /^(lesson\s*no\.?|topic|active learning|required reading|assessment|assignments?|exams?|schedule|course|semester)\s*:?\s*$/i.test(line);
    if (isTableHeader) return;
    if (!weekMatch && !lessonRowActive) return;

    if (lessonRowActive) {
      if (lessonTopicCaptured && !isExplicitAssessment) return;
      if (!lessonTopicCaptured && !isExplicitAssessment) type = "Topic";
      lessonTopicCaptured = true;
    }

    let week = weekMatch ? Number(weekMatch[1]) : Math.max(1, lastWeek);
    if (weekMatch) {
      lastWeek = week;
      lessonRowActive = startsWithWeek;
      lessonTopicCaptured = startsWithWeek;
    }
    const title = cleanTitle(line);
    if (!title || title.length < 3) return;

    const key = `${week}-${title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ week, title, type, notes: "" });
  });

  return addPreparationTasks(items);
}

function addPreparationTasks(items) {
  const expanded = [...items];
  items.forEach((item) => {
    if (item.type === "Exam") {
      if (item.week > 2) expanded.push({ week: item.week - 2, title: `Start reviewing for ${item.title}`, type: "Review", notes: "Organize notes and identify weak areas." });
      if (item.week > 1) expanded.push({ week: item.week - 1, title: `Practice for ${item.title}`, type: "Review", notes: "Complete a focused practice session." });
    }
    if (item.type === "Assignment" && item.week > 1) {
      expanded.push({ week: Math.max(1, item.week - 2), title: `Start ${item.title}`, type: "Review", notes: "Break the work into small steps." });
    }
  });
  return expanded.sort((a, b) => a.week - b.week || a.type.localeCompare(b.type));
}

async function extractPdf(file) {
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.mjs";
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const lines = [];
    let currentLine = [];
    let previousY = null;
    content.items.forEach((item) => {
      const y = Math.round(item.transform?.[5] || 0);
      if (previousY !== null && Math.abs(y - previousY) > 3 && currentLine.length) {
        lines.push(currentLine.join(" "));
        currentLine = [];
      }
      currentLine.push(item.str);
      previousY = y;
    });
    if (currentLine.length) lines.push(currentLine.join(" "));
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
}

async function extractDocx(file) {
  if (!window.mammoth) throw new Error("The DOCX reader could not load. Check your internet connection.");

  const arrayBuffer = await file.arrayBuffer();
  const [htmlResult, textResult] = await Promise.all([
    window.mammoth.convertToHtml({ arrayBuffer }),
    window.mammoth.extractRawText({ arrayBuffer }),
  ]);

  const documentView = new DOMParser().parseFromString(htmlResult.value, "text/html");
  const normalizedRows = [];

  documentView.querySelectorAll("table").forEach((table) => {
    const rows = [...table.querySelectorAll("tr")];
    if (rows.length < 2) return;

    const headers = [...rows[0].querySelectorAll("th, td")].map((cell) =>
      cell.textContent.replace(/\s+/g, " ").trim()
    );
    const lessonColumn = headers.findIndex((header) =>
      /lesson\s*(?:no\.?|number)|מס['׳״]?\s*השיעור|מספר\s*השיעור/i.test(header)
    );
    const topicColumn = headers.findIndex((header) =>
      /^topic$|lesson\s*topic|נושא\s*השיעור/i.test(header)
    );
    const assessmentColumn = headers.findIndex((header) =>
      /assessment|הערכה/i.test(header)
    );

    if (lessonColumn === -1 || topicColumn === -1) return;
    normalizedRows.push("Lesson No.");

    rows.slice(1).forEach((row) => {
      const cells = [...row.querySelectorAll("th, td")].map((cell) =>
        cell.textContent.replace(/\s+/g, " ").trim()
      );
      const lessonNumber = cells[lessonColumn]?.match(/\d{1,2}/)?.[0];
      const topic = cells[topicColumn] || "";
      const assessment = assessmentColumn >= 0 ? cells[assessmentColumn] || "" : "";

      if (!lessonNumber || !topic) return;
      normalizedRows.push(lessonNumber, topic);
      if (assessment) normalizedRows.push(assessment);
    });
  });

  return normalizedRows.length ? normalizedRows.join("\n") : textResult.value;
}

async function readFile(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Please choose a file smaller than 20 MB.");
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "pdf") return extractPdf(file);
  if (extension === "txt") return file.text();
  if (extension === "docx") return extractDocx(file);
  throw new Error("Use a PDF, DOCX, or TXT file.");
}

function chooseFile(file) {
  if (!file) return;
  selectedFile = file;
  elements.fileLabel.textContent = file.name;
  setStatus("File ready. Choose the semester start date, then create your roadmap.");
}

function weekDate(startDate, weekNumber) {
  const date = new Date(`${startDate}T12:00:00`);
  date.setDate(date.getDate() + (weekNumber - 1) * 7);
  return date;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function renderRoadmap(items, startDate) {
  const grouped = new Map();
  items.forEach((item) => {
    if (!grouped.has(item.week)) grouped.set(item.week, []);
    grouped.get(item.week).push(item);
  });

  roadmapWeeks = [...grouped.entries()].map(([week, tasks]) => ({
    week,
    date: weekDate(startDate, week),
    tasks,
  }));

  elements.roadmap.innerHTML = roadmapWeeks.map(({ week, date, tasks }) => `
    <article class="week">
      <div class="week-number">Week ${week}<span class="week-date">${formatDate(date)}</span></div>
      <div class="tasks">
        ${tasks.map((task) => `
          <div class="task ${task.type.toLowerCase()}">
            <span class="task-dot" aria-hidden="true"></span>
            <div>
              <div class="task-title">${escapeHtml(task.title)}</div>
              ${task.notes ? `<div class="task-note">${escapeHtml(task.notes)}</div>` : ""}
            </div>
            <span class="task-type">${escapeHtml(task.type)}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");

  elements.roadmapSummary.textContent = `${items.length} calendar items across ${roadmapWeeks.length} active weeks`;
  elements.roadmapSection.hidden = false;
  elements.roadmapSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function icsDate(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function escapeIcs(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function downloadCalendar() {
  const events = roadmapWeeks.flatMap(({ week, date, tasks }) =>
    tasks.map((task, index) => {
      const eventDate = new Date(date);
      eventDate.setDate(eventDate.getDate() + Math.min(index, 5));
      const endDate = new Date(eventDate);
      endDate.setDate(endDate.getDate() + 1);
      const uid = `${week}-${index}-${Date.now()}@syllabus-roadmap`;
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
        `DTSTART;VALUE=DATE:${icsDate(eventDate)}`,
        `DTEND;VALUE=DATE:${icsDate(endDate)}`,
        `SUMMARY:${escapeIcs(task.title)}`,
        `DESCRIPTION:${escapeIcs(`${task.type}${task.notes ? ` — ${task.notes}` : ""}`)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
  );

  const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Syllabus Roadmap//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...events, "END:VCALENDAR"].join("\r\n");
  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "syllabus-roadmap.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

elements.fileInput.addEventListener("change", () => chooseFile(elements.fileInput.files[0]));
elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("dragging");
});
elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("dragging");
  chooseFile(event.dataTransfer.files[0]);
});

elements.generateBtn.addEventListener("click", async () => {
  if (!elements.semesterStart.value) {
    setStatus("Choose the semester start date so calendar events have the right dates.", "error");
    return;
  }

  elements.generateBtn.disabled = true;
  setStatus("Reading your syllabus and building the roadmap…");
  try {
    let text = elements.syllabusInput.value.trim();
    if (selectedFile) text = (await readFile(selectedFile)).trim();
    if (!text) throw new Error("Choose a syllabus file or paste its text first.");
    if (text.length < 20) throw new Error("Very little text was found. Scanned PDFs may need OCR.");

    elements.syllabusInput.value = text;
    const items = parseSyllabus(text);
    if (!items.length) throw new Error("No dated course items were found. Try pasting the schedule section of the syllabus.");
    renderRoadmap(items, elements.semesterStart.value);
    setStatus("Roadmap ready.", "success");
  } catch (error) {
    setStatus(error.message || "The syllabus could not be processed.", "error");
  } finally {
    elements.generateBtn.disabled = false;
  }
});

elements.downloadBtn.addEventListener("click", downloadCalendar);

const today = new Date();
elements.semesterStart.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

if (new URLSearchParams(location.search).has("sample")) {
  elements.syllabusInput.value = SAMPLE_SYLLABUS;
}
