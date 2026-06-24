const { getStore } = require("@netlify/blobs");

const DEFAULT_DATA = {
  calendarEvents: [],
  todoTasks: [],
  dailyDiaryEntries: {}
};

exports.handler = async function (event) {
  try {
    const store = getStore({
  name: "personal-dashboard",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_TOKEN,
  consistency: "strong"
});

    const key = "today-page-data";

    if (event.httpMethod === "GET") {
      const saved = await store.get(key, { type: "json" });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saved || DEFAULT_DATA)
      };
    }

    if (event.httpMethod === "POST") {
      const incoming = JSON.parse(event.body || "{}");

      const data = {
        calendarEvents: Array.isArray(incoming.calendarEvents) ? incoming.calendarEvents : [],
        todoTasks: Array.isArray(incoming.todoTasks) ? incoming.todoTasks : [],
        dailyDiaryEntries: incoming.dailyDiaryEntries || {}
      };

      await store.setJSON(key, data);

      const check = await store.get(key, { type: "json" });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          savedAt: new Date().toISOString(),
          counts: {
            calendarEvents: check?.calendarEvents?.length || 0,
            todoTasks: check?.todoTasks?.length || 0,
            diaryEntries: Object.keys(check?.dailyDiaryEntries || {}).length
          }
        })
      };
    }

    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Dashboard data function failed",
        details: error.message
      })
    };
  }
};
