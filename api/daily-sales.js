let cache = {
  value: null,
  lastFetch: 0
};

const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const API_VERSION = "2024-01";

const STORES = [
  { store: process.env.SHOP_JP, token: process.env.TOKEN_JP },
  { store: process.env.SHOP_US, token: process.env.TOKEN_US },
  { store: process.env.SHOP_AUS, token: process.env.TOKEN_AUS }
];

export default async function handler(req, res) {
  try {
    const now = Date.now();

    if (cache.value !== null && now - cache.lastFetch < CACHE_TIME) {
      return res.status(200).json({ number: cache.value });
    }

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    let totalOrders = 0;

    for (const s of STORES) {
      if (!s.store || !s.token) continue;

      let nextPage = null;

      do {
        const url = new URL(`https://${s.store}/admin/api/${API_VERSION}/orders.json`);
        url.searchParams.set("status", "any");
        url.searchParams.set("financial_status", "paid");
        url.searchParams.set("created_at_min", todayStart.toISOString());
        url.searchParams.set("limit", "250");
        if (nextPage) url.searchParams.set("page_info", nextPage);

        const response = await fetch(url.toString(), {
          headers: { "X-Shopify-Access-Token": s.token }
        });

        const data = await response.json();
        totalOrders += data.orders.length;

        const link = response.headers.get("link");
        nextPage = null;
        if (link && link.includes('rel="next"')) {
          const m = link.match(/page_info=([^&>]+)/);
          if (m) nextPage = m[1];
        }
      } while (nextPage);
    }

    cache.value = totalOrders;
    cache.lastFetch = now;

    return res.status(200).json({ number: totalOrders });
  } catch (e) {
    return res.status(500).json({ number: 0 });
  }
}