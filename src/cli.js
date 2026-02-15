#!/usr/bin/env node
import path from "node:path";
import { runWorkflow, captureSession } from "./runner.js";
import { runViaOpenClaw, openclawMetadata } from "./openclawAdapter.js";
import { loadWorkflow } from "./runner.js";
import { buildOpenClawCommand } from "./openclawAdapter.js";

function parseArgs(argv) {
  const args = {};
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [rawKey, rawValue] = arg.slice(2).split("=");
    const key = rawKey;

    if (rawValue !== undefined) {
      args[key] = rawValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return { args, positional };
}

function usage() {
  return `
Clawtomations CLI

Commands:
  run        Execute a workflow
  capture    Capture a site login session state
  serve      Start a tiny local control panel
  schedule   Create a macOS launchd plist (daily cron)
  openclaw   Print/execute OpenClaw command for a workflow

Common options:
  --workflow   Path to workflow yaml (required for run)
  --output     Override output root (default: workflow file outputs/)
  --headless   true|false for browser runs
  --openclaw   Run through OpenClaw adapter (instead of local Playwright run)

Examples:
  node src/cli.js capture --site google --url https://accounts.google.com
  node src/cli.js run --workflow workflows/sample-workflow.yaml
  node src/cli.js run --workflow workflows/sample-workflow.yaml --headless=false
  node src/cli.js openclaw --workflow workflows/sample-workflow.yaml
`;
}

async function cmdRun(args) {
  const workflow = args.workflow || "workflows/sample-workflow.yaml";
  const outputDir = args.output;
  const headless = args.headless === undefined ? undefined : args.headless === "true";

  if (args.openclaw) {
    const meta = await buildOpenClawCommand({
      workflowPath: path.resolve(process.cwd(), workflow),
      outputPath: path.resolve(process.cwd(), outputDir || "outputs"),
      workflowConfig: (await loadWorkflow(path.resolve(process.cwd(), workflow))).workflow
    });
    return console.log(meta);
  }

  const result = await runWorkflow({
    workflowPath: path.resolve(process.cwd(), workflow),
    outputDir,
    headless,
    continueOnError: args.continueOnError === "true",
    stopOnFailure: args.stopOnFailure === "true",
    extra: {
      workflow,
      cli: args
    }
  });

  console.log(`Run complete: ${result.report.status}`);
  console.log(`Run ID: ${result.runId}`);
  console.log(`Report: ${result.reportPath}`);
  return result;
}

async function cmdCapture(args) {
  const alias = args.site || args.alias || "default";
  const url = args.url;
  if (!url) {
    throw new Error("--url is required for capture");
  }

  const output = args.output || `${alias}-session.json`;
  const result = await captureSession({
    alias,
    url,
    output,
    baseDir: process.cwd()
  });
  console.log(`Saved auth state: ${result.authState}`);
  return result;
}

async function cmdServe(args) {
  const { default: runServer } = await import("./server.js");
  const port = Number(args.port || 8787);
  return runServer(port);
}

function writeLaunchdPlist({ workflow, time, projectRoot }) {
  const [hour, minute] = String(time).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error("--time must be HH:MM");
  }

  const home = process.env.HOME;
  const label = `com.clawtomations.daily`;
  const plistPath = `${home}/Library/LaunchAgents/${label}.plist`;
  const command = `node ${projectRoot}/src/cli.js run --workflow ${projectRoot}/${workflow}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-lc</string>
    <string>${command}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${home}/Library/Logs/clawtomations.out.log</string>
  <key>StandardErrorPath</key>
  <string>${home}/Library/Logs/clawtomations.err.log</string>
</dict>
</plist>
`;

  return { label, plistPath, xml, command };
}

async function cmdSchedule(args) {
  const workflow = args.workflow || "workflows/sample-workflow.yaml";
  const time = args.time || "09:00";
  const projectRoot = process.cwd();
  const { label, plistPath, xml, command } = writeLaunchdPlist({
    workflow,
    time,
    projectRoot
  });

  const fs = await import("node:fs/promises");
  await fs.writeFile(plistPath, xml);
  console.log(`Launchd file: ${plistPath}`);
  console.log(`Command: ${command}`);

  if (args.install) {
    const { execSync } = await import("node:child_process");
    execSync(`launchctl bootstrap gui/$(id -u) ${plistPath}`, { stdio: "inherit", shell: true });
    console.log(`Loaded launchd job: ${label}`);
  } else {
    console.log("Run with --install to register the daily job now.");
  }
}

async function cmdOpenClaw(args) {
  const workflow = args.workflow || "workflows/sample-workflow.yaml";
  const outputPath = args.output || "outputs";
  const absWorkflow = path.resolve(process.cwd(), workflow);
  const { workflow: parsed } = await loadWorkflow(absWorkflow);

  if (args.exec) {
    const result = await runViaOpenClaw({
      workflowPath: absWorkflow,
      outputPath,
      workflowConfig: parsed
    });
    console.log("OpenClaw exit:", result.exitCode);
    console.log("Command:", result.command);
    return result;
  }

  const metadata = openclawMetadata({
    workflowPath: absWorkflow,
    outputPath,
    workflowConfig: parsed
  });
  console.log(`Generated OpenClaw command:\n${metadata.command}`);
  return metadata;
}

async function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0] || "run";

  if (args.help || args.h) {
    console.log(usage());
    return;
  }

  if (command === "run") return cmdRun(args);
  if (command === "capture") return cmdCapture(args);
  if (command === "serve") return cmdServe(args);
  if (command === "schedule") return cmdSchedule(args);
  if (command === "openclaw") return cmdOpenClaw(args);

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
