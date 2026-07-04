/* ============================================================================
   SOMNUS — shared mock data (globe.html + markets.html)
   ----------------------------------------------------------------------------
   Every layer is one array/object; each entry documents the shape a live
   endpoint should return so a backend can replace it without touching render
   code. Exposed on window.SOMNUS_DATA for no-build sharing across pages.

     MARKET_DATA   -> GET /api/markets            [{ iso, name, index, change, value }]
     SESSIONS_DATA -> GET /api/exchanges          [{ name, city, lat, lon, tz, open, close }]
     OIL_DATA      -> GET /api/commodities/oil    [{ name, lat, lon, bpd }]
     POP_HEAT      -> GET /api/population/density  [{ name, lat, lon, radius, intensity }]
     CITIES_DATA   -> GET /api/cities/mega         [{ name, lat, lon, pop }]
     METALS_DATA   -> GET /api/mining             [{ name, lat, lon, metal }]
     TRADE_ROUTES  -> GET /api/trade/routes       [{ from:[lat,lon], to:[lat,lon], label }]
     TICKER_DATA   -> GET /api/ticker             [{ sym, val, chg, iso? }]
   ============================================================================ */
(function (global) {
  "use strict";

  const MARKET_DATA = [
    { iso: "US", name: "S&P 500",  index: 4783.45,  value: "4,783.45",  lat: 38,   lon: -97,   change: 0.8 },
    { iso: "DE", name: "DAX",      index: 17650.20, value: "17,650.20", lat: 51,   lon: 10,    change: -0.4 },
    { iso: "JP", name: "Nikkei",   index: 39120.50, value: "39,120.50", lat: 36,   lon: 138,   change: 1.2 },
    { iso: "IN", name: "Sensex",   index: 73245.00, value: "73,245.00", lat: 21,   lon: 79,    change: 0.6 },
    { iso: "BR", name: "Bovespa",  index: 127880.0, value: "127,880",   lat: -10,  lon: -52,   change: -1.1 },
    { iso: "GB", name: "FTSE 100", index: 7712.40,  value: "7,712.40",  lat: 54,   lon: -2,    change: 0.3 },
    { iso: "FR", name: "CAC 40",   index: 7935.10,  value: "7,935.10",  lat: 47,   lon: 2,     change: -0.2 },
    { iso: "CN", name: "SSE Comp", index: 3015.60,  value: "3,015.60",  lat: 35,   lon: 103,   change: -0.7 },
    { iso: "CA", name: "TSX",      index: 21540.30, value: "21,540.30", lat: 56,   lon: -106,  change: 0.5 },
    { iso: "AU", name: "ASX 200",  index: 7620.90,  value: "7,620.90",  lat: -25,  lon: 134,   change: 0.9 },
    { iso: "KR", name: "KOSPI",    index: 2645.80,  value: "2,645.80",  lat: 36,   lon: 128,   change: 1.5 },
    { iso: "MX", name: "IPC",      index: 55210.00, value: "55,210",    lat: 23,   lon: -102,  change: -0.3 },
    { iso: "RU", name: "MOEX",     index: 3210.40,  value: "3,210.40",  lat: 61,   lon: 90,    change: 2.1 },
    { iso: "IT", name: "FTSE MIB", index: 32180.00, value: "32,180",    lat: 42,   lon: 12,    change: 0.1 },
    { iso: "ES", name: "IBEX 35",  index: 10120.50, value: "10,120.50", lat: 40,   lon: -4,    change: -0.6 },
    { iso: "NL", name: "AEX",      index: 862.40,   value: "862.40",    lat: 52,   lon: 5,     change: 0.4 },
    { iso: "CH", name: "SMI",      index: 11380.20, value: "11,380.20", lat: 47,   lon: 8,     change: 0.2 },
    { iso: "SE", name: "OMX Stkh", index: 2465.30,  value: "2,465.30",  lat: 60,   lon: 15,    change: 0.7 },
    { iso: "ZA", name: "JSE",      index: 74850.00, value: "74,850",    lat: -29,  lon: 24,    change: -0.9 },
    { iso: "SA", name: "TASI",     index: 11920.00, value: "11,920",    lat: 24,   lon: 45,    change: 0.3 },
    { iso: "ID", name: "JCI",      index: 7285.60,  value: "7,285.60",  lat: -2,   lon: 118,   change: 1.0 },
    { iso: "SG", name: "STI",      index: 3195.40,  value: "3,195.40",  lat: 1.3,  lon: 103.8, change: 0.4 },
    { iso: "HK", name: "HSI",      index: 16340.20, value: "16,340.20", lat: 22.3, lon: 114.2, change: -1.8 },
    { iso: "TR", name: "BIST 100", index: 9120.80,  value: "9,120.80",  lat: 39,   lon: 35,    change: 3.2 },
    { iso: "AR", name: "MERVAL",   index: 1085400,  value: "1,085,400", lat: -34,  lon: -64,   change: 4.5 },
  ];

  const SESSIONS_DATA = [
    { name: "NYSE",  city: "New York",  lat: 40.7,  lon: -74.0,  tz: "America/New_York",  open: 9.5,  close: 16.0 },
    { name: "LSE",   city: "London",    lat: 51.5,  lon: -0.1,   tz: "Europe/London",     open: 8.0,  close: 16.5 },
    { name: "XETRA", city: "Frankfurt", lat: 50.1,  lon: 8.7,    tz: "Europe/Berlin",     open: 9.0,  close: 17.5 },
    { name: "TSE",   city: "Tokyo",     lat: 35.7,  lon: 139.7,  tz: "Asia/Tokyo",        open: 9.0,  close: 15.0 },
    { name: "HKEX",  city: "Hong Kong", lat: 22.3,  lon: 114.2,  tz: "Asia/Hong_Kong",    open: 9.5,  close: 16.0 },
    { name: "ASX",   city: "Sydney",    lat: -33.9, lon: 151.2,  tz: "Australia/Sydney",  open: 10.0, close: 16.0 },
    { name: "NSE",   city: "Mumbai",    lat: 19.1,  lon: 72.9,   tz: "Asia/Kolkata",      open: 9.25, close: 15.5 },
  ];

  const OIL_DATA = [
    { name: "Ghawar, Saudi Arabia",    lat: 25.4,  lon: 49.6,   bpd: 11.0 },
    { name: "Permian Basin, USA",      lat: 31.8,  lon: -102.5, bpd: 6.0 },
    { name: "West Siberia, Russia",    lat: 61.0,  lon: 70.0,   bpd: 10.0 },
    { name: "Alberta, Canada",         lat: 56.0,  lon: -111.5, bpd: 4.5 },
    { name: "Rumaila, Iraq",           lat: 30.4,  lon: 47.4,   bpd: 4.4 },
    { name: "Abu Dhabi, UAE",          lat: 24.0,  lon: 53.8,   bpd: 3.2 },
    { name: "Orinoco Belt, Venezuela", lat: 8.5,   lon: -63.0,  bpd: 0.8 },
    { name: "Niger Delta, Nigeria",    lat: 5.0,   lon: 6.5,    bpd: 1.3 },
    { name: "Al-Burgan, Kuwait",       lat: 29.0,  lon: 47.9,   bpd: 2.7 },
    { name: "Campos Basin, Brazil",    lat: -22.0, lon: -40.5,  bpd: 3.1 },
  ];

  const POP_HEAT = [
    { name: "Gangetic Plain, India",  lat: 26,   lon: 80,  radius: 12, intensity: 1.0 },
    { name: "East China",             lat: 32,   lon: 114, radius: 12, intensity: 0.95 },
    { name: "Java, Indonesia",        lat: -7,   lon: 110, radius: 6,  intensity: 0.85 },
    { name: "Nile Delta, Egypt",      lat: 30,   lon: 31,  radius: 5,  intensity: 0.8 },
    { name: "Western Europe",         lat: 49,   lon: 8,   radius: 9,  intensity: 0.75 },
    { name: "US East Coast",          lat: 39,   lon: -77, radius: 8,  intensity: 0.7 },
    { name: "Lagos Corridor, Nigeria",lat: 6.5,  lon: 4,   radius: 5,  intensity: 0.65 },
    { name: "Bangladesh",             lat: 24,   lon: 90,  radius: 5,  intensity: 0.9 },
  ];

  const CITIES_DATA = [
    { name: "Tokyo",         lat: 35.68,  lon: 139.69,  pop: 37.4 },
    { name: "Delhi",         lat: 28.61,  lon: 77.21,   pop: 32.9 },
    { name: "Shanghai",      lat: 31.23,  lon: 121.47,  pop: 29.2 },
    { name: "Dhaka",         lat: 23.81,  lon: 90.41,   pop: 22.5 },
    { name: "São Paulo",     lat: -23.55, lon: -46.63,  pop: 22.4 },
    { name: "Mexico City",   lat: 19.43,  lon: -99.13,  pop: 22.3 },
    { name: "Cairo",         lat: 30.04,  lon: 31.24,   pop: 21.7 },
    { name: "Mumbai",        lat: 19.08,  lon: 72.88,   pop: 21.3 },
    { name: "Beijing",       lat: 39.90,  lon: 116.40,  pop: 21.3 },
    { name: "New York",      lat: 40.71,  lon: -74.01,  pop: 18.8 },
    { name: "Karachi",       lat: 24.86,  lon: 67.01,   pop: 16.8 },
    { name: "Istanbul",      lat: 41.01,  lon: 28.98,   pop: 15.5 },
    { name: "Kolkata",       lat: 22.57,  lon: 88.36,   pop: 15.1 },
    { name: "Lagos",         lat: 6.52,   lon: 3.38,    pop: 14.9 },
    { name: "Manila",        lat: 14.60,  lon: 120.98,  pop: 14.4 },
    { name: "Guangzhou",     lat: 23.13,  lon: 113.26,  pop: 14.5 },
    { name: "Rio de Janeiro",lat: -22.91, lon: -43.17,  pop: 13.5 },
    { name: "Moscow",        lat: 55.76,  lon: 37.62,   pop: 12.6 },
    { name: "Los Angeles",   lat: 34.05,  lon: -118.24, pop: 12.5 },
    { name: "London",        lat: 51.51,  lon: -0.13,   pop: 9.4 },
  ];

  const METALS_DATA = [
    { name: "Witwatersrand Gold, South Africa", lat: -26.2, lon: 27.9,   metal: "gold" },
    { name: "Shandong Gold, China",             lat: 37.4,  lon: 118.5,  metal: "gold" },
    { name: "WA Goldfields, Australia",         lat: -30.7, lon: 121.4,  metal: "gold" },
    { name: "Nevada Gold Belt, USA",            lat: 40.8,  lon: -116.4, metal: "gold" },
    { name: "Escondida, Chile",                 lat: -24.3, lon: -69.1,  metal: "copper" },
    { name: "Cerro Verde, Peru",                lat: -16.5, lon: -71.6,  metal: "copper" },
    { name: "Katanga, DRC",                     lat: -10.7, lon: 25.5,   metal: "copper" },
    { name: "Jiangxi Copper, China",            lat: 29.7,  lon: 115.8,  metal: "copper" },
    { name: "Greenbushes, Australia",           lat: -33.9, lon: 116.1,  metal: "lithium" },
    { name: "Salar de Atacama, Chile",          lat: -23.5, lon: -68.2,  metal: "lithium" },
    { name: "Hombre Muerto, Argentina",         lat: -25.4, lon: -66.9,  metal: "lithium" },
    { name: "Bayan Obo, China",                 lat: 41.8,  lon: 109.9,  metal: "rare-earth" },
    { name: "Mountain Pass, USA",               lat: 35.5,  lon: -115.5, metal: "rare-earth" },
    { name: "Mount Weld, Australia",            lat: -28.9, lon: 122.5,  metal: "rare-earth" },
  ];

  const METAL_COLORS = { gold: 0xFFD700, copper: 0xFF7F50, lithium: 0x00E5FF, "rare-earth": 0xB266FF };

  const TRADE_ROUTES = [
    { from: [31.2, 121.5],  to: [34.0, -118.2], label: "Shanghai → Los Angeles" },
    { from: [51.9, 4.5],    to: [40.7, -74.0],  label: "Rotterdam → New York" },
    { from: [1.35, 103.8],  to: [25.2, 55.3],   label: "Singapore → Dubai" },
    { from: [22.5, 114.0],  to: [53.5, 10.0],   label: "Shenzhen → Hamburg" },
    { from: [19.0, 72.9],   to: [51.5, -0.1],   label: "Mumbai → London" },
    { from: [-33.9, 151.2], to: [35.7, 139.7],  label: "Sydney → Tokyo" },
  ];

  const TICKER_DATA = [
    { sym: "S&P 500", val: "4,783.45",  chg: 0.82,  iso: "US" },
    { sym: "NASDAQ",  val: "16,920.10", chg: 1.10,  iso: "US" },
    { sym: "DOW",     val: "38,150.30", chg: 0.45,  iso: "US" },
    { sym: "GOLD",    val: "$2,385.50", chg: 0.34 },
    { sym: "OIL WTI", val: "$78.42",    chg: -0.60 },
    { sym: "BTC/USD", val: "$67,230",   chg: 2.15 },
    { sym: "EUR/USD", val: "1.0845",    chg: -0.12 },
    { sym: "DAX",     val: "17,650.20", chg: -0.38, iso: "DE" },
    { sym: "NIKKEI",  val: "39,120.50", chg: 1.22,  iso: "JP" },
    { sym: "US 10Y",  val: "4.28%",     chg: 0.03 },
  ];

  // world-atlas feature ids are numeric ISO 3166-1 codes; map to the alpha-2
  // codes used by MARKET_DATA (only countries we track need an entry).
  const ISO_N3_TO_A2 = {
    "840": "US", "276": "DE", "392": "JP", "356": "IN", "076": "BR", "826": "GB",
    "250": "FR", "156": "CN", "124": "CA", "036": "AU", "410": "KR", "484": "MX",
    "643": "RU", "380": "IT", "724": "ES", "528": "NL", "756": "CH", "752": "SE",
    "710": "ZA", "682": "SA", "360": "ID", "702": "SG", "344": "HK", "792": "TR",
    "032": "AR",
  };

  global.SOMNUS_DATA = {
    MARKET_DATA, SESSIONS_DATA, OIL_DATA, POP_HEAT, CITIES_DATA,
    METALS_DATA, METAL_COLORS, TRADE_ROUTES, TICKER_DATA, ISO_N3_TO_A2,
  };
})(window);
