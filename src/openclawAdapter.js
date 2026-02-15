import { execSync } from "node:child_process";
import { renderTemplate } from "./template.js";

function parseVersion(raw) {
  if (!raw) {
    return { major: null, raw: "" };
  }
  const match = String(raw).trim().match(/(\d+)\.(\d+)\.(\d+)/);
  return {
    major: match ? Number(match[1]) : null,
    raw: String(raw).trim()
  };
}

export function detectOpenClawVersion(bin = "openclaw") {
  try {
    const raw = execSync(`${bin} --version`, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    return parseVersion(raw);
  } catch {
    return { major: null, raw: "" };
  }
}

function defaultCommand(version, bin) {
  if (version.major >= 2) {
    return `${bin} agent run --workflow {{workflow}} --output {{output}} --name clawtomations`;
  }
  return `${bin} run --workflow {{workflow}} --output {{output}}`;
}

export function buildOpenClawCommand({ workflowPath, outputPath, workflowConfig }) {
  const envTemplate = process.env.CLAWTOMATIONS_OPENCLAW_COMMAND;
  const cliBin = process.env.CLAWTOMATIONS_OPENCLAW_BIN || "openclaw";
  const configTemplate = workflowConfig?.openclaw?.command || workflowConfig?.openclaw?.template;
  const version = detectOpenClawVersion(cliBin);
  const template = configTemplate || envTemplate || defaultCommand(version, cliBin);
  return renderTemplate(template, {
    workflow: {
      path: workflowPath,
      output: outputPath,
      label: workflowConfig?.name || "run"
    },
    outputs: {},
    env: process.env
  });
}

export function runViaOpenClaw({ workflowPath, outputPath, workflowConfig }) {
  const command = buildOpenClawCommand({ workflowPath, outputPath, workflowConfig });
  const proc = execSync(command, { stdio: "inherit", shell: true });
  return { command, exitCode: proc?.status ?? 0 };
}

export function openclawMetadata({ workflowPath, outputPath, workflowConfig }) {
  const command = buildOpenClawCommand({ workflowPath, outputPath, workflowConfig });
  return {
    adapter: "openclaw",
    command
  };
}
