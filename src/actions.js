import path from "node:path";
import fs from "node:fs/promises";
import { renderTemplate, buildTemplateContext } from "./template.js";

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function resolveLocator(page, selector) {
  return page.locator(selector);
}

export async function executeStep(page, step, context) {
  const action = step.action || step.type;
  const output = {};

  switch (action) {
    case "navigate": {
      const url = renderTemplate(step.url || "", context);
      await page.goto(url, {
        waitUntil: step.waitUntil || "domcontentloaded",
        timeout: step.timeoutMs || 30000
      });
      break;
    }
    case "open": {
      const url = renderTemplate(step.url || "", context);
      await page.goto(url, {
        waitUntil: step.waitUntil || "domcontentloaded",
        timeout: step.timeoutMs || 30000
      });
      break;
    }
    case "click": {
      const selector = renderTemplate(step.selector || "", context);
      await resolveLocator(page, selector).click({ timeout: step.timeoutMs || 30000 });
      break;
    }
    case "fill": {
      const selector = renderTemplate(step.selector || "", context);
      const value = renderTemplate(step.value || "", context);
      await resolveLocator(page, selector).fill(value, { timeout: step.timeoutMs || 30000 });
      break;
    }
    case "press": {
      const selector = renderTemplate(step.selector || "", context);
      await resolveLocator(page, selector).press(step.key, { timeout: step.timeoutMs || 30000 });
      break;
    }
    case "check": {
      const selector = renderTemplate(step.selector || "", context);
      await resolveLocator(page, selector).check({ timeout: step.timeoutMs || 30000 });
      break;
    }
    case "uncheck": {
      const selector = renderTemplate(step.selector || "", context);
      await resolveLocator(page, selector).uncheck({ timeout: step.timeoutMs || 30000 });
      break;
    }
    case "select": {
      const selector = renderTemplate(step.selector || "", context);
      await resolveLocator(page, selector).selectOption(step.value, { timeout: step.timeoutMs || 30000 });
      break;
    }
    case "waitForSelector": {
      const selector = renderTemplate(step.selector || "", context);
      await page.waitForSelector(selector, { timeout: step.timeoutMs || 30000, state: step.state || "visible" });
      break;
    }
    case "wait": {
      await page.waitForTimeout(step.ms || 1000);
      break;
    }
    case "screenshot": {
      const fileName = renderTemplate(step.file || `screenshot-${Date.now()}.png`, context);
      const outputPath = path.join(context.run.siteOutputDir, fileName);
      await ensureDir(context.run.siteOutputDir);
      await page.screenshot({ path: outputPath, fullPage: step.fullPage !== false });
      output[renderTemplate(step.key || "screenshot", context)] = outputPath;
      break;
    }
    case "copy": {
      const selector = renderTemplate(step.selector || "", context);
      const key = renderTemplate(step.key || "copied_value", context);
      const locator = await resolveLocator(page, selector).first();
      let value;
      if (step.attribute) {
        value = await locator.getAttribute(step.attribute);
      } else {
        value = await locator.textContent();
      }
      output[key] = (value || "").toString().trim();
      break;
    }
    case "upload": {
      const selector = renderTemplate(step.selector || "", context);
      const filePath = renderTemplate(step.file, context);
      await resolveLocator(page, selector).setInputFiles(filePath);
      break;
    }
    case "eval": {
      const script = String(step.script || "");
      await page.evaluate(script);
      break;
    }
    case "focus": {
      const selector = renderTemplate(step.selector || "", context);
      await resolveLocator(page, selector).focus({ timeout: step.timeoutMs || 30000 });
      break;
    }
    case "hover": {
      const selector = renderTemplate(step.selector || "", context);
      await resolveLocator(page, selector).hover({ timeout: step.timeoutMs || 30000 });
      break;
    }
    default:
      throw new Error(`Unsupported action: ${action}`);
  }

  return output;
}

export function cloneContext(context, patch) {
  return buildTemplateContext({
    workflow: { ...(context.workflow || {}), ...(patch.workflow || {}) },
    site: { ...(context.site || {}), ...(patch.site || {}) },
    runId: context.run.id,
    outputs: { ...(context.outputs || {}), ...(patch.outputs || {}) },
    vars: context.workflow?.vars || {}
  });
}
