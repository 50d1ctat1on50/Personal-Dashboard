const cheerio = require("cheerio");

const SOURCES = [
  "https://www.ozbargain.com.au/competition/all",
  "https://www.ozbargain.com.au/competition",
  "https://www.aussiecomps.com/",
  "https://auscomps.au/competitions"
];

function scoreCompetition(item) {
  const text = `${item.title} ${item.reason}`.toLowerCase();
  let score = 0;

  if (text.includes("australia-wide")) score += 30;
  if (text.includes("australia")) score += 15;
  if (text.includes("website")) score += 25;
  if (text.includes("lucky draw")) score += 20;
  if (text.includes("entry form")) score += 20;
  if (text.includes("free")) score += 15;
  if (text.includes("no purchase")) score += 15;

  if (text.includes("instagram")) score -= 30;
  if (text.includes("facebook")) score -= 25;
  if (text.includes("tiktok")) score -= 25;
  if (text.includes("purchase")) score -= 30;
  if (text.includes("receipt")) score -= 30;
  if (text.includes("subscribe")) score -= 8;
  if (text.includes("25 words")) score -= 10;
  if (text.includes("no. of words")) score -= 10;
  if (text.includes("nsw") || text.includes("vic") || text.includes("qld") || text.includes("wa only")) score -= 10;

  return score;
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 Personal Alpine Dashboard"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return await response.text();
}

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractOzBargain(html) {
  const $ = cheerio.load(html);
  const results = [];

  $(".node, .node-competition, article, .content").each((_, el) => {
    const block = cleanText($(el).text());
    const titleLink = $(el).find("h2 a, h3 a, a[href*='/node/']").first();

    let title = cleanText(titleLink.text());

    if (!title || !title.toLowerCase().includes("win")) return;

    const allLinks = $(el).find("a").map((_, a) => ({
      text: cleanText($(a).text()),
      href: $(a).attr("href")
    })).get();

    const external = allLinks.find(l =>
      l.href &&
      l.href.startsWith("http") &&
      !l.href.includes("ozbargain.com.au")
    );

    const internal = absoluteUrl(titleLink.attr("href"), "https://www.ozbargain.com.au");

    const url = external?.href || internal;

    if (!url) return;

    const reasonParts = [];

    if (/australia-wide/i.test(block)) reasonParts.push("Australia-wide");
    if (/website/i.test(block)) reasonParts.push("Website entry");
    if (/lucky draw/i.test(block)) reasonParts.push("Lucky draw");
    if (/no\.? of words|25 words/i.test(block)) reasonParts.push("Short answer required");
    if (/prize pool/i.test(block)) {
      const prize = block.match(/Prize pool\s*\$?[\d,]+(\.\d+)?/i);
      if (prize) reasonParts.push(prize[0]);
    }

    results.push({
      title,
      reason: reasonParts.length
        ? reasonParts.join(" · ")
        : "Australian competition listing",
      url,
      source: "OzBargain",
      raw: block
    });
  });

  return results;
}

function extractGeneric(html, baseUrl, sourceName) {
  const $ = cheerio.load(html);
  const results = [];

  $("a").each((_, a) => {
    const text = cleanText($(a).text());
    const href = $(a).attr("href");
    const url = absoluteUrl(href, baseUrl);

    if (!url) return;
    if (!/win|competition|giveaway|enter/i.test(text)) return;
    if (text.length < 12) return;

    results.push({
      title: text.slice(0, 120),
      reason: `Free Australian competition listing from ${sourceName}`,
      url,
      source: sourceName,
      raw: text
    });
  });

  return results;
}

function dedupe(items) {
  const seen = new Set();

  return items.filter(item => {
    const key = item.url.split("?")[0].toLowerCase();

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

exports.handler = async function () {
  try {
    let all = [];

    for (const source of SOURCES) {
      try {
        const html = await fetchHtml(source);

        if (source.includes("ozbargain")) {
          all = all.concat(extractOzBargain(html));
        } else if (source.includes("aussiecomps")) {
          all = all.concat(extractGeneric(html, source, "AussieComps"));
        } else if (source.includes("auscomps")) {
          all = all.concat(extractGeneric(html, source, "AusComps"));
        }
      } catch (err) {
        console.log(`Source failed: ${source}`, err.message);
      }
    }

    const filtered = dedupe(all)
      .map(item => ({
        ...item,
        score: scoreCompetition(item)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => ({
        title: item.title,
        reason: `${item.reason} · Selected for being free/simple/Australia-focused`,
        url: item.url,
        source: item.source
      }));

    const fallback = [
      {
        title: "OzBargain Competitions - Australia-wide website entries",
        reason: "Fallback source if live scraping fails.",
        url: "https://www.ozbargain.com.au/competition/all",
        source: "OzBargain"
      },
      {
        title: "AussieComps - New Australian Competitions",
        reason: "Fallback source if live scraping fails.",
        url: "https://www.aussiecomps.com/",
        source: "AussieComps"
      },
      {
        title: "AusComps - Free Australian Competitions",
        reason: "Fallback source if live scraping fails.",
        url: "https://auscomps.au/competitions",
        source: "AusComps"
      }
    ];

    const today = filtered.length ? filtered : fallback;

    return {
      statusCode: 200,
      body: JSON.stringify({
        updated: new Date().toLocaleString("en-AU", {
          timeZone: "Australia/Perth"
        }),
        today,
        yesterday: today
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not load competitions.",
        details: error.message
      })
    };
  }
};
