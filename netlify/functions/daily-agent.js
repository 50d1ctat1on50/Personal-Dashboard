const OpenAI = require("openai");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { diary, todaySchedule, todayTasks, freeWindows } = JSON.parse(event.body || "{}");

    const client = new OpenAI();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Jed's practical daily planning assistant. Be concise, calm, positive, and action-focused. Do not diagnose or give medical advice."
        },
        {
          role: "user",
          content: `
Yesterday's diary:
${diary || "No diary entry provided."}

Today's schedule:
${todaySchedule || "No schedule provided."}

Today's assigned tasks:
${todayTasks || "No tasks assigned."}

Today's free windows:
${freeWindows || "No free windows provided."}

Return:
1. A short mindset reflection.
2. The top 1-3 priorities for today.
3. The best use of available free time.
4. One positive reinforcement sentence.

Keep the whole response under 120 words.
`
        }
      ],
      temperature: 0.7,
      max_tokens: 180
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        summary: response.choices?.[0]?.message?.content || "No response returned."
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
