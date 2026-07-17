const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["week", "date", "title", "type", "notes", "confidence", "evidence", "needsReview"],
        properties: {
          week: { type: "integer", minimum: 1, maximum: 52 },
          date: { type: ["string", "null"] },
          title: { type: "string", minLength: 2, maxLength: 180 },
          type: { type: "string", enum: ["Exam", "Assignment", "Reading", "Review", "Topic"] },
          notes: { type: "string", maxLength: 300 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string", minLength: 1, maxLength: 240 },
          needsReview: { type: "boolean" },
        },
      },
    },
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function responseText(result) {
  if (typeof result.output_text === "string") return result.output_text;
  return (result.output || [])
    .flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
}

async function extractSyllabus(request, env) {
  if (!env.OPENAI_API_KEY) return json({ error: "AI service is not configured." }, 503);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 300_000) return json({ error: "The syllabus text is too large." }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const semesterStart = typeof body.semesterStart === "string" ? body.semesterStart : "";
  if (text.length < 20 || text.length > 250_000 || !/^\d{4}-\d{2}-\d{2}$/.test(semesterStart)) {
    return json({ error: "Add a valid syllabus and semester start date." }, 400);
  }

  const prompt = `Extract a trustworthy course roadmap from the syllabus below.

Success criteria:
- Include every explicitly supported dated deadline, exam, assignment, reading, and scheduled topic.
- Derive week numbers from the semester start date (${semesterStart}) or explicit week/lesson numbers.
- Use ISO YYYY-MM-DD for date only when the syllabus supports an exact date; otherwise use null.
- Never invent a date, title, requirement, or week.
- Quote the shortest exact syllabus evidence for each item.
- Set needsReview true when wording, year, date, or week mapping is ambiguous, or confidence is below 0.85.
- Add preparation Review items only for explicit exams or assignments; label them clearly and keep their evidence tied to the source item.
- Deduplicate repeated schedule entries.

Syllabus:
${text}`;

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6-terra",
      reasoning: { effort: "low" },
      instructions: "You are a careful academic schedule analyst. Extract only claims grounded in the provided syllabus. Return the required JSON schema.",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "syllabus_roadmap",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
      max_output_tokens: 12000,
    }),
  });

  const result = await openAIResponse.json();
  if (!openAIResponse.ok) {
    console.error("OpenAI extraction failed", openAIResponse.status, result?.error?.type);
    return json({ error: "AI extraction failed. Please try again shortly." }, 502);
  }

  try {
    const parsed = JSON.parse(responseText(result));
    const items = parsed.items
      .filter((item) => Number.isInteger(item.week) && item.week >= 1 && item.week <= 52)
      .map((item) => ({
        ...item,
        confidence: Math.max(0, Math.min(1, Number(item.confidence))),
        needsReview: Boolean(item.needsReview) || Number(item.confidence) < 0.85,
      }));
    return json({ items });
  } catch {
    return json({ error: "AI returned an invalid roadmap. Please try again." }, 502);
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/extract") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      return extractSyllabus(request, env);
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const assetUrl = new URL(pathname, request.url);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};

export default worker;
