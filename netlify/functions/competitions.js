const cheerio = require("cheerio");
const OpenAI = require("openai");

const SOURCE_PAGES = [
  {
    name: "OzBargain",
    url: "https://www.ozbargain.com.au/competition/all"
  },
  {
    name: "AussieComps",
    url: "https://www.aussiecomps.com/"
  },
  {
    name: "AusComps",
    url: "https://auscomps.au/competitions"
  },
  {
    name: "Competitions Guide",
    url: "https://www.competitionsguide.com.au/"
  }
];

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 Alpine Dashboard Competition Agent"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return await response.text();
}

function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractCandidateLinks(html, baseUrl, sourceName) {
  const $ = cheerio.load(html);
  const links = [];

  $("a").each((_, a) => {
    const text = cleanText($(a).text());
    const href = $(a).attr("href");
    const url = absoluteUrl(href, baseUrl);

    if (!url || !text) return;

    const combined = `${text} ${url}`.toLowerCase();

    const likelyCompetition =
      combined.includes("win") ||
      combined.includes("competition") ||
      combined.includes("giveaway") ||
      combined.includes("prize") ||
      combined.includes("enter");

    const badLink =
      combined.includes("login") ||
      combined.includes("register") ||
      combined.includes("privacy") ||
      combined.includes("terms") ||
      combined.includes("contact") ||
      combined.includes("facebook.com") ||
      combined.includes("instagram.com") ||
      combined.includes("tiktok.com");

    if (!likelyCompetition || badLink) return;

    links.push({
      source: sourceName,
      title: text.slice(0, 140),
      url
    });
  });

  return links;
}

function dedupeLinks(links) {
  const seen = new Set();

  return links.filter(link => {
    const key = link.url.split("?")[0].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPageSummary(html, url) {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header").remove();

  const title =
    cleanText($("h1").first().text()) ||
    cleanText($("title").first().text()) ||
    "Competition";

  const bodyText = cleanText($("body").text()).slice(0, 5000);

  const formIndicators = [];
  if ($("form").length) formIndicators.push("Has form");
  if ($("input").length) formIndicators.push(`${$("input").length} inputs`);
  if ($("textarea").length) formIndicators.push(`${$("textarea").length} text areas`);
  if ($("select").length) formIndicators.push(`${$("select").length} dropdowns`);

  return {
    title,
    url,
    text: bodyText,
    formIndicators: formIndicators.join(", ") || "No visible form detected"
  };
}

function roughScore(page) {
  const text = `${page.title} ${page.text} ${page.formIndicators}`.toLowerCase();

  let score = 0;

  if (text.includes("free")) score += 20;
  if (text.includes("no purchase")) score += 25;
  if (text.includes("australia")) score += 20;
  if (text.includes("australian residents")) score += 25;
  if (text.includes("australia-wide")) score += 25;
  if (text.includes("enter now")) score += 20;
  if (text.includes("entry form")) score += 20;
  if (text.includes("lucky draw")) score += 20;
  if (text.includes("game of chance")) score += 15;
  if (text.includes("form")) score += 15;

  if (text.includes("purchase")) score -= 35;
  if (text.includes("receipt")) score -= 35;
  if (text.includes("instagram")) score -= 25;
  if (text.includes("facebook")) score -= 25;
  if (text.includes("tiktok")) score -= 25;
  if (text.includes("25 words")) score -= 15;
  if (text.includes("creative answer")) score -= 15;
  if (text.includes("upload")) score -= 15;
  if (text.includes("photo")) score -= 10;
  if (text.includes("video")) score -= 20;

  const inputMatch = page.formIndicators.match(/(\d+) inputs/);
  if (inputMatch) {
    const inputs = Number(inputMatch[1]);
    if (inputs <= 8) score += 20;
    if (inputs > 12) score -= 15;
  }

  return score;
}

async function askAiToPickBest(pages) {
  const client = new OpenAI();

  const compact = pages.map((p, index) => ({
    id: index + 1,
    title: p.title,
    url: p.url,
    source: p.source,
    roughScore: p.roughScore,
    formIndicators: p.formIndicators,
    textSample: p.text.slice(0, 1200)
  }));

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: `
You are a competition-filtering assistant for an Australian user.

Select the best 5 competitions from the provided candidates.

Criteria:
- Must be free to enter or no purchase required.
- Must be open to Australia or Australian residents.
- Prefer simple entry forms.
- Prefer website entry pages over social media entries.
- Prefer easy lucky-draw/game-of-chance competitions.
- Avoid purchase-required, receipt upload, social-media-only, creative-answer, video/photo upload, or complex competitions.
- If the page is not clearly an individual competition entry page, rank it lower.

Return strict JSON only:
{
  "top5": [
    {
      "title": "",
      "reason": "",
      "url": "",
      "source": "",
      "ease": "Easy/Medium/Hard"
    }
  ]
}
`
      },
      {
        role: "user",
        content: JSON.stringify(compact)
      }
    ]
  ]
  });

  const text = response.choices?.[0]?.message?.content || "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();

  return JSON.parse(cleaned);
}

exports.handler = async function () {
  try {
    let candidateLinks = [];

    for (const source of SOURCE_PAGES) {
      try {
        const html = await fetchHtml(source.url);
        const links = extractCandidateLinks(html, source.url, source.name);
        candidateLinks.push(...links);
      } catch (err) {
        console.log(`Failed source page: ${source.name}`, err.message);
      }
    }

    candidateLinks = dedupeLinks(candidateLinks).slice(0, 35);

    const pages = [];

    for (const candidate of candidateLinks) {
      try {
        const html = await fetchHtml(candidate.url);
        const page = extractPageSummary(html, candidate.url);

        pages.push({
          ...page,
          source: candidate.source,
          roughScore: roughScore(page)
        });
      } catch (err) {
        console.log(`Failed detail page: ${candidate.url}`, err.message);
      }
    }

    const worthwhile = pages
      .filter(p => p.roughScore > 10)
      .sort((a, b) => b.roughScore - a.roughScore)
      .slice(0, 18);

    let top5 = [];

    if (worthwhile.length) {
      try {
        const aiResult = await askAiToPickBest(worthwhile);
        top5 = aiResult.top5 || [];
      } catch (err) {
        console.log("AI selection failed, using fallback scoring.", err.message);

        top5 = worthwhile.slice(0, 5).map(p => ({
          title: p.title,
          reason: `Selected by scoring logic. ${p.formIndicators}. Appears Australia/free/simple-entry focused.`,
          url: p.url,
          source: p.source,
          ease: "Medium"
        }));
      }
    }

    if (!top5.length) {
      top5 = [
        {
          title: "OzBargain Competitions",
          reason: "Fallback page. Could not confidently extract individual competitions today.",
          url: "https://www.ozbargain.com.au/competition/all",
          source: "OzBargain",
          ease: "Medium"
        }
      ];
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        updated: new Date().toLocaleString("en-AU", {
          timeZone: "Australia/Perth"
        }),
        today: top5,
        yesterday: top5
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Competition agent failed.",
        details: error.message
      })
    };
  }
};
