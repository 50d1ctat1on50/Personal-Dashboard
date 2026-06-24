const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

async function callGemini(model, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 300
        }
      })
    }
  );

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const {
      diary,
      diaryArchive,
      todaySchedule,
      todayTasks,
      freeWindows,
      upcomingThreeDays,
      outstandingTodos
    } = JSON.parse(event.body || "{}");

    const prompt = `
You are Jed's practical daily planning assistant.

Use this information:
- Yesterday's diary
- Last 30 days of diary notes
- Today's calendar
- Today's assigned tasks
- Today's free time windows
- Upcoming 3 days calendar
- Outstanding unscheduled to-do list

Yesterday's diary:
${diary || "No diary entry provided for yesterday."}

Last 30 days of diary notes:
${diaryArchive || "No diary archive provided."}

Today's calendar:
${todaySchedule || "No schedule provided."}

Today's assigned calendar tasks:
${todayTasks || "No tasks assigned."}

Today's free time windows:
${freeWindows || "No free windows provided."}

Upcoming 3 days calendar:
${upcomingThreeDays || "No upcoming calendar provided."}

Outstanding unscheduled to-do list:
${outstandingTodos || "No outstanding tasks."}

Create a practical Plan for the Day.

Return:
1. Short mindset reflection based on diary history.
2. Today's top 1-3 priorities.
3. Best use of free time.
4. Anything that should be deferred to the next 3 days.
5. One positive reinforcement sentence.

Keep it under 150 words.
Be practical, calm, positive and action-focused.
Do not diagnose or give medical advice.
`;

    let lastError = null;

    for (const model of MODELS) {
      const result = await callGemini(model, prompt);

      if (result.ok) {
        const summary =
          result.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No AI summary returned.";

        return {
          statusCode: 200,
          body: JSON.stringify({
            summary,
            modelUsed: model
          })
        };
      }

      lastError = {
        model,
        status: result.status,
        message: result.data?.error?.message || "Unknown Gemini error"
      };

      // Only retry on temporary/load errors
      if (![429, 500, 503].includes(result.status)) {
        break;
      }
    }

    return {
      statusCode: lastError?.status || 500,
      body: JSON.stringify({
        error: "Gemini request failed.",
        details: lastError?.message || "All Gemini models failed.",
        modelTried: lastError?.model || null
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Daily agent failed.",
        details: error.message
      })
    };
  }
};
