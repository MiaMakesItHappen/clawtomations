import process from "node:process";

export function nowContext() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    timestamp: now.getTime(),
    unix: Math.floor(now.getTime() / 1000)
  };
}

function resolveExpression(expr, context) {
  if (expr.startsWith("env.")) {
    const key = expr.slice("env.".length);
    return process.env[key] ?? "";
  }

  if (expr.startsWith("now.")) {
    const key = expr.slice("now.".length);
    return nowContext()[key] ?? "";
  }

  if (expr.startsWith("site.")) {
    const key = expr.slice("site.".length);
    return context.site?.[key] ?? "";
  }

  if (expr.startsWith("workflow.")) {
    const key = expr.slice("workflow.".length);
    return context.workflow?.[key] ?? "";
  }

  if (expr.startsWith("run.")) {
    const key = expr.slice("run.".length);
    return context.run?.[key] ?? "";
  }

  if (expr.startsWith("outputs.")) {
    const key = expr.slice("outputs.".length);
    return context.outputs?.[key] ?? "";
  }

  if (expr in (context.vars || {})) {
    return context.vars[expr];
  }

  return context[expr] ?? "";
}

export function renderTemplate(value, context) {
  if (typeof value === "string") {
    return value.replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => {
      const resolved = resolveExpression(expr, context);
      return resolved == null ? "" : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => renderTemplate(entry, context));
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const [key, rawValue] of Object.entries(value)) {
      out[key] = renderTemplate(rawValue, context);
    }
    return out;
  }

  return value;
}

export function buildTemplateContext({ workflow, site, runId, outputs = {}, vars = {} }) {
  return {
    workflow,
    site,
    vars,
    run: {
      id: runId,
      startedAt: new Date().toISOString()
    },
    outputs,
    now: nowContext(),
    env: process.env
  };
}
