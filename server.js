/* eslint-disable no-console */
const http = require("node:http");
const { parse } = require("node:url");

require("dotenv").config();

const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

// Bind to 0.0.0.0 for LAN/Docker, but browsing should typically use localhost.
const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;

// Don't pass hostname into Next unless you explicitly need it; 0.0.0.0 is a bind addr,
// not a resolvable host name (can lead to confusing browser errors if clicked).
const app = next({ dev, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      })
      .listen(port, hostname, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${displayHost}:${port} (${dev ? "dev" : "prod"})`);
      });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
