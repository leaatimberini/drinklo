import { chromium } from "playwright";

const storefrontUrl = process.env.PERF_STOREFRONT_URL;
const thresholds = {
  ttfb: Number(process.env.PERF_TTFB_MS ?? 600),
  lcp: Number(process.env.PERF_LCP_MS ?? 2500),
};

async function measure(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.addInitScript(() => {
    window.__perf = { lcp: 0 };
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      window.__perf.lcp = last.startTime;
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto(url, { waitUntil: "load" });

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const ttfb = nav ? nav.responseStart - nav.requestStart : 0;
    const lcp = window.__perf?.lcp ?? 0;
    return { ttfb, lcp };
  });

  await browser.close();
  return metrics;
}

async function main() {
  if (!storefrontUrl) {
    console.log("PERF_STOREFRONT_URL not set. Skipping storefront perf.");
    return;
  }

  const home = await measure(storefrontUrl);

  console.log(`storefront_home: ttfb=${Math.round(home.ttfb)}ms lcp=${Math.round(home.lcp)}ms`);

  let failed = false;
  if (home.ttfb > thresholds.ttfb) {
    console.error(`TTFB threshold exceeded: ${home.ttfb}ms > ${thresholds.ttfb}ms`);
    failed = true;
  }
  if (home.lcp > thresholds.lcp) {
    console.error(`LCP threshold exceeded: ${home.lcp}ms > ${thresholds.lcp}ms`);
    failed = true;
  }

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
