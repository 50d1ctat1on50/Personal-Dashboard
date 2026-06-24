const { getStore } = require("@netlify/blobs");

const DEFAULT_DATA = {
  calendarEvents: [],
  todoTasks: [],
  dailyDiaryEntries: {}
};

exports.handler = async function (event) {
  const store = getStore("personal-dashboard");
  const key = "today-page-data";

  if (event.httpMethod === "GET") {
    const saved = await store.get(key, { type: "json" });

    return {
      statusCode: 200,
      body: JSON.stringify(saved || DEFAULT_DATA)
    };
  }

  if (event.httpMethod === "POST") {
    const incoming = JSON.parse(event.body || "{}");

    const data = {
      calendarEvents: incoming.calendarEvents || [],
      todoTasks: incoming.todoTasks || [],
      dailyDiaryEntries: incoming.dailyDiaryEntries || {}
    };

    await store.setJSON(key, data);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        savedAt: new Date().toISOString()
      })
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: "Method not allowed" })
  };
};
