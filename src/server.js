import http from "node:http";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runWorkflow } from "./runner.js";

const htmlPath = path.resolve(process.cwd(), "public/index.html");

function send(res, code, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, {
    "content-type": headers["content-type"] || "application/json",
    "access-control-allow-origin": "*"
  });
  res.end(payload);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function runServer(port = 8787) {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || "/", `http://localhost:${port}`);

    if (req.method === "GET" && parsedUrl.pathname === "/") {
      const html = await fs.readFile(htmlPath, "utf8");
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(html);
    }

    if (req.method === "GET" && parsedUrl.pathname === "/health") {
      return send(res, 200, { status: "ok" });
    }

    if (req.method === "POST" && parsedUrl.pathname === "/run") {
      try {
        const body = await parseJsonBody(req);
        const workflow = body.workflow || "workflows/sample-workflow.yaml";
        const outputDir = body.outputDir;
        const result = await runWorkflow({
          workflowPath: path.resolve(process.cwd(), workflow),
          outputDir
        });

        return send(res, 200, {
          ok: true,
          runId: result.runId,
          status: result.report.status,
          report: result.reportPath
        });
      } catch (error) {
        return send(res, 500, {
          ok: false,
          message: error.message
        });
      }
    }

    return send(res, 404, { ok: false, message: "Not found" });
  });

  server.listen(port, () => {
    console.log(`Clawtomations control panel: http://localhost:${port}`);
  });
}
