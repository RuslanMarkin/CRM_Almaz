import { parseStageBranch } from "./stage-contract.mjs";

export function parseWorkspaceTask(body) {
  const match = body?.match(/<!-- sdlc-workspace-task:([A-Za-z0-9_-]+) -->/);
  if (!match) return null;
  try {
    const task = JSON.parse(
      Buffer.from(match[1], "base64url").toString("utf8")
    );
    if (!task || typeof task !== "object" || !parseStageBranch(task.branch))
      return null;
    return task;
  } catch {
    return null;
  }
}
