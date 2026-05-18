/* eslint-disable no-console */
const http = require("node:http");
const { parse } = require("node:url");

require("dotenv").config();

const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
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
        console.log(`> Ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
      });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

