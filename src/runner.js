import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import yaml from "js-yaml";
import { chromium } from "playwright";
import { executeStep } from "./actions.js";
import { buildTemplateContext, renderTemplate } from "./template.js";

function sanitizeName(value) {
  return String(value || "site").toLowerCase().replace(/[^a-z0-9-_]/g, "_");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function mergeSteps(steps = [], siteSteps = []) {
  return [...steps, ...siteSteps];
}

export async function loadWorkflow(workflowPath) {
  const absPath = path.resolve(workflowPath);
  const raw = await fs.readFile(absPath, "utf8");
  const workflow = yaml.load(raw);
  return { workflow, absPath, dirname: path.dirname(absPath) };
}

async function promptEnter(message) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  await rl.question(message);
  rl.close();
}

export async function captureSession({ alias, url, output, baseDir = process.cwd() }) {
  const workflowRoot = baseDir;
  const authDir = path.resolve(workflowRoot, "auth");
  await fs.mkdir(authDir, { recursive: true });

  const outPath = path.resolve(
    authDir,
    output || `${sanitizeName(alias)}-session.json`
  );

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const startUrl = renderTemplate(url, {});
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });

  await promptEnter("Login to the site, complete any 2FA, then press Enter to capture the session state: ");

  await context.storageState({ path: outPath });
  await browser.close();

  return {
    alias,
    authState: outPath,
    startedAt: new Date().toISOString()
  };
}

function resolveWorkflowPath(value, baseDir) {
  if (!value) {
    return value;
  }
  return path.isAbsolute(value) ? value : path.join(baseDir, value);
}

export async function runWorkflow(options) {
  const {
    workflowPath,
    outputDir,
    headless,
    extra,
    continueOnError: overrideContinue,
    stopOnFailure = false
  } = options;

  const loaded = await loadWorkflow(workflowPath);
  const workflow = loaded.workflow || {};
  const workflowBase = loaded.dirname;
  const defaults = workflow.defaults || {};
  const settings = workflow.settings || {};

  const runId = `run-${Date.now()}`;
  const rootOutput = path.resolve(
    workflowBase,
    outputDir || settings.outputDir || "./outputs"
  );
  const runOutputDir = path.resolve(rootOutput, runId);
  const launchHeadless =
    typeof headless === "boolean"
      ? headless
      : settings.headless !== false;

  const baseContext = buildTemplateContext({
    workflow,
    site: {},
    runId,
    outputs: {},
    vars: workflow.vars || {}
  });

  await fs.mkdir(runOutputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: launchHeadless,
    slowMo: settings.slowMo || 0
  });

  const sites = workflow.sites || [];
  const results = [];
  const continueOnFailure = overrideContinue ?? settings.continueOnFailure ?? stopOnFailure === false;
  const maxTimeout = settings.timeoutMs || 30000;

  try {
    for (const rawSite of sites) {
      const site = {
        name: rawSite.name || rawSite.url || `site-${sites.indexOf(rawSite) + 1}`,
        ...rawSite
      };

      const siteOutputDir = path.join(runOutputDir, sanitizeName(site.name));
      await fs.mkdir(siteOutputDir, { recursive: true });

      const statePath = site.authState
        ? path.resolve(workflowBase, site.authState)
        : null;
      const authAvailable = statePath ? await fileExists(statePath) : false;
      if (site.requiresLogin && !authAvailable) {
        throw new Error(`Missing auth state for site ${site.name} (${statePath})`);
      }

      const context = await browser.newContext({
        viewport: settings.viewport || undefined,
        storageState: authAvailable ? statePath : undefined
      });
      const page = await context.newPage();

      const runContext = {
        ...baseContext,
        site,
        run: {
          id: runId,
          siteOutputDir,
          workflowOutputDir: runOutputDir,
          startedAt: new Date().toISOString()
        }
      };

      const outputs = {};
      const steps = mergeSteps(defaults.steps, site.steps);

      let status = "success";
      const errors = [];

      try {
        for (const [index, step] of steps.entries()) {
          const hydrated = renderTemplate(step, runContext);
          const stepOutputs = await executeStep(page, hydrated, {
            ...runContext,
            run: {
              ...runContext.run,
              currentStepIndex: index + 1,
              timeoutMs: step.timeoutMs || maxTimeout
            },
            outputs
          });

          if (stepOutputs && Object.keys(stepOutputs).length > 0) {
            Object.assign(outputs, stepOutputs);
          }
        }
      } catch (error) {
        status = "failed";
        errors.push({
          message: error.message,
          stack: error.stack
        });

        if (!continueOnFailure) {
          await context.close();
          throw error;
        }
      } finally {
        await page.close();
        await context.close();
      }

      const stepResultPath = path.join(siteOutputDir, "outputs.json");
      await fs.writeFile(stepResultPath, safeJson({
        site: site.name,
        status,
        outputs,
        errors
      }));

      results.push({
        site: site.name,
        status,
        outputs,
        errors,
        outputDir: siteOutputDir
      });

      if (status === "failed" && !continueOnFailure) {
        break;
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    workflow: workflowPath,
    runId,
    startedAt: new Date().toISOString(),
    settings: {
      headless: launchHeadless
    },
    results,
    status: results.some((site) => site.status === "failed") ? "failed" : "success",
    extra
  };

  const reportPath = path.join(runOutputDir, "run-report.json");
  await fs.writeFile(reportPath, safeJson(report));

  return {
    runId,
    outputDir: runOutputDir,
    reportPath,
    report
  };
}

export async function bootstrapFromCLI(args) {
  return runWorkflow(args);
}
