const express = require("express");
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const list = [
  { url: "https://www.surveycake.com/s/DYxaX", status: "active" },
  { url: "https://www.surveycake.com/s/PXAwM", status: "active" },
  { url: "https://www.surveycake.com/s/DYxGe", status: "active" },
  { url: "https://www.surveycake.com/s/og7N2", status: "active" },
];
const clicks = Object.fromEntries(list.map((item) => [item.url, 0]));
let logs = [];
let randomFlag = false,
  i = 0;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", true);

app.use(
  session({
    secret: "my-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use((req, res, next) => {
  console.log(`Request: ${req.url} | IP: ${req.ip}`);
  next();
});

app.get("/test", (req, res) => {
  const activeList = list.filter((item) => item.status === "active");
  if (!activeList.length)
    return res.status(500).send("No active URLs available.");

  if (!req.session.url) {
    const index = randomFlag
      ? getRandomInt(0, activeList.length)
      : i++ % activeList.length;
    req.session.url = activeList[index].url;
    clicks[req.session.url]++;
  }

  logs.push({ url: req.session.url, ip: req.ip, timestamp: new Date() });
  res.render("redirect", { redirectUrl: req.session.url });
});

app.get("/clear", (req, res) => {
  Object.keys(clicks).forEach((key) => (clicks[key] = 0));
  logs = [];
  i = 0;
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Failed to clear session.");
  });
  res.redirect("/logs");
});

app.get("/logs", (req, res) => {
  const linksData = list.map((item) => ({
    ...item,
    clicks: clicks[item.url] || 0,
  }));
  const nextLink =
    list.filter((item) => item.status === "active")[i % list.length]?.url ||
    "No active links";
  res.render("logs3", { logs, linksData, nextLink, randomFlag });
});

app.post(
  "/update-status",
  express.urlencoded({ extended: true }),
  (req, res) => {
    const { url, status } = req.body;
    const item = list.find((item) => item.url === url);
    if (!item || !["active", "suspended"].includes(status))
      return res.status(400).send("Invalid data.");
    item.status = status;
    res.redirect("/logs");
  }
);

app.post("/update-url", express.urlencoded({ extended: true }), (req, res) => {
  const { oldUrl, newUrl } = req.body;
  if (!newUrl || !/^https?:\/\/.+/.test(newUrl) || oldUrl === newUrl)
    return res.status(400).send("Invalid URL.");
  const item = list.find((item) => item.url === oldUrl);
  if (!item) return res.status(404).send("URL not found.");
  item.url = newUrl;
  clicks[newUrl] = 0;
  delete clicks[oldUrl];
  res.redirect("/logs");
});

app.post("/toggle-random-flag", express.json(), (req, res) => {
  if (typeof req.body.randomFlag !== "boolean")
    return res.status(400).send("Invalid data.");
  randomFlag = req.body.randomFlag;
  res.json({ success: true, randomFlag });
});

const totalClick = () =>
  Object.values(clicks).reduce((sum, count) => sum + count, 0);
const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min)) + min;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
