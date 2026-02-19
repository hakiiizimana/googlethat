import axios from "axios";
import * as cheerio from "cheerio";

export function buildUrl({ query, tbs, hl = "en", gl = "us", page = 1 }) {
  if (!query) throw new Error("Query is required");

  const params = new URLSearchParams();

  params.append("q", query.trim());
  params.append("hl", hl);
  params.append("gl", gl);

  if (tbs) params.append("tbs", tbs);
  if (page > 1) params.append("start", (page - 1) * 10);

  return {
    url: `https://www.google.com/search?${params.toString()}`,
    params: {
      q: query.trim(),
      hl,
      gl,
      tbs,
      page,
    },
  };
}

const client = axios.create({
  baseURL: "https://crawl4ai.siirathic.com",
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

export function getPayload(url) {
  return {
    urls: [url],
    browser_config: {
      type: "BrowserConfig",
      params: { headless: true },
    },
    crawler_config: {
      type: "CrawlerRunConfig",
      params: { cache_mode: "BYPASS" },
    },
  };
}

export function getPayloadForMultipleUrls(urls) {
  return {
    urls: urls,
    browser_config: { type: "BrowserConfig", params: { headless: true } },
    crawler_config: {
      type: "CrawlerRunConfig",
      params: { cache_mode: "BYPASS" },
    },
  };
}

function parseKnowledgeGraph($) {
  const titleEl = $('[data-attrid="title"]');
  if (!titleEl.length) return undefined;

  const title = titleEl.text().trim();
  if (!title) return undefined;

  const website =
    $('[data-attrid="ShoppingMerchantWebsite"] a').attr("href") || "";

  const descEl = $('[data-attrid="ShoppingMerchantDescription"]');
  const descClone = descEl.clone();
  descClone.find("a").remove();
  const description = descClone.text().trim();
  const descLinks = descEl.find("a");
  let descriptionSource = "";
  let descriptionLink = "";
  descLinks.each((_i, a) => {
    const href = $(a).attr("href");
    const text = $(a).text().trim();
    if (href && text) {
      descriptionSource = text;
      descriptionLink = href;
    }
  });

  const imageUrl = $('[data-attrid="image"] img').attr("src") || "";

  const attributes = {};
  $("[data-attrid]").each((_i, el) => {
    const attrid = $(el).attr("data-attrid") || "";
    if (!attrid.startsWith("kc:")) return;

    const spans = [];
    $(el)
      .find("span")
      .each((_j, s) => {
        const t = $(s).text().trim();
        if (t && t !== ":") spans.push(t);
      });

    const unique = [...new Set(spans)];
    if (unique.length >= 2) {
      const label = unique[0].replace(/:$/, "");
      const value = unique[unique.length - 1];
      if (label && value && label !== value) {
        attributes[label] = value;
      }
    }
  });

  const kg = { title };
  if (website) kg.website = website;
  if (imageUrl && !imageUrl.startsWith("data:")) kg.imageUrl = imageUrl;
  if (description) kg.description = description;
  if (descriptionSource) kg.descriptionSource = descriptionSource;
  if (descriptionLink) kg.descriptionLink = descriptionLink;
  if (Object.keys(attributes).length) kg.attributes = attributes;
  return kg;
}

function parseOrganic($) {
  const results = [];
  let position = 0;

  $("div.MjjYud").each((_i, el) => {
    const container = $(el);
    const title = container.find("h3").first().text().trim();
    if (!title) return;

    position++;
    const link =
      container.find("a.zReHs").first().attr("href") ||
      container.find("a").first().attr("href") ||
      "";

    const rawSnippet = (
      container.find("div.VwiC3b").first().text().trim() ||
      container.find("[data-sncf]").first().text().trim() ||
      ""
    )
      .replace(/Read more$/, "")
      .trim();

    let date;
    const dateMatch = rawSnippet.match(
      /^(\d{1,2}\s+\w+\s+ago|\w{3,9}\s+\d{1,2},?\s*\d{4}|\d+\s+days?\s+ago)\s*[—–-]\s*/i,
    );
    const snippet = dateMatch
      ? rawSnippet.slice(dateMatch[0].length).trim()
      : rawSnippet;
    if (dateMatch) date = dateMatch[1];

    const sitelinks = [];
    const mainHost = link ? new URL(link).hostname : "";
    container.find("a[href]").each((_j, sEl) => {
      const sLink = $(sEl).attr("href") || "";
      const sTitle = $(sEl).text().trim();
      if (
        !sTitle ||
        sTitle === title ||
        sLink === link ||
        !sLink.startsWith("http") ||
        sLink.includes("google.com") ||
        sLink.includes("#:~:text=") ||
        sTitle === "Read more"
      )
        return;
      try {
        if (mainHost && new URL(sLink).hostname.endsWith(mainHost)) {
          sitelinks.push({ title: sTitle, link: sLink });
        }
      } catch (error) {
        console.error(error);
      }
    });

    const entry = { title, link, snippet, position };
    if (date) entry.date = date;
    if (sitelinks.length) entry.sitelinks = sitelinks;
    results.push(entry);
  });

  return results;
}

function parsePeopleAlsoAsk($) {
  const results = [];
  $("div.related-question-pair").each((_i, el) => {
    const div = $(el);
    const question = div.attr("data-q") || div.text().trim();
    if (!question) return;

    const snippet =
      div.find("[data-md]").text().trim() ||
      div.find(".wDYxhc").text().trim() ||
      "";
    const linkEl = div
      .find("a[href]")
      .filter((_j, a) => {
        const href = $(a).attr("href") || "";
        return href.startsWith("http") && !href.includes("google.com/search");
      })
      .first();
    const link = linkEl.attr("href") || "";
    const title = linkEl.find("h3").text().trim() || linkEl.text().trim() || "";

    const entry = { question };
    if (snippet) entry.snippet = snippet;
    if (title) entry.title = title;
    if (link) entry.link = link;
    results.push(entry);
  });
  return results;
}

function parseRelatedSearches($) {
  const results = [];
  $("div.y6Uyqe a").each((_i, el) => {
    const query = $(el).text().trim();
    if (query && !results.find((r) => r.query === query)) {
      results.push({ query });
    }
  });
  return results;
}

export async function searchGoogle(payload) {
  const res = await client.post("/crawl", payload);
  const result = res.data.results?.[0] ?? res.data;
  const html = result.html;

  if (!html) {
    throw new Error("No HTML returned from crawl4ai");
  }

  const $ = cheerio.load(html);

  const knowledgeGraph = parseKnowledgeGraph($);
  const organic = parseOrganic($);
  const peopleAlsoAsk = parsePeopleAlsoAsk($);
  const relatedSearches = parseRelatedSearches($);

  if (
    !knowledgeGraph &&
    !organic.length &&
    !peopleAlsoAsk.length &&
    !relatedSearches.length
  ) {
    return null;
  }

  const output = {};
  if (knowledgeGraph) output.knowledgeGraph = knowledgeGraph;
  if (organic.length) output.organic = organic;
  if (peopleAlsoAsk.length) output.peopleAlsoAsk = peopleAlsoAsk;
  if (relatedSearches.length) output.relatedSearches = relatedSearches;

  return output;
}

export async function getMarkdownFromUrls(urls) {
  const payload = getPayloadForMultipleUrls(urls);
  const res = await client.post(`/crawl`, payload);
  const results = res.data.results;
  const formatted = results.map((result, index) => ({
    url: urls[index],
    markdown: result.markdown?.raw_markdown ?? null,
  }));
  return formatted;
}
