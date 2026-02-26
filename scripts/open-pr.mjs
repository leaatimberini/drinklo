import { execSync } from "node:child_process";

function runGit(args) {
  return execSync(`git ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function parseGitHubRemote(remoteUrl) {
  const normalized = remoteUrl.trim();

  const httpsMatch = normalized.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  const sshProtocolMatch = normalized.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshProtocolMatch) {
    return { owner: sshProtocolMatch[1], repo: sshProtocolMatch[2] };
  }

  throw new Error(`Unsupported origin remote URL (expected GitHub): ${remoteUrl}`);
}

function main() {
  const baseBranch = (process.env.BASE_BRANCH ?? "main").trim() || "main";
  const headBranch = runGit("rev-parse --abbrev-ref HEAD");
  const originUrl = runGit("remote get-url origin");
  const { owner, repo } = parseGitHubRemote(originUrl);

  const compareUrl = `https://github.com/${owner}/${repo}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(headBranch)}?expand=1`;
  const pullNewUrl = `https://github.com/${owner}/${repo}/pull/new/${encodeURIComponent(headBranch)}`;

  process.stdout.write("GitHub PR helper\n");
  process.stdout.write(`- Base branch: ${baseBranch}\n`);
  process.stdout.write(`- Head branch: ${headBranch}\n`);
  process.stdout.write(`- Compare (recommended): ${compareUrl}\n`);
  process.stdout.write(`- New PR shortcut: ${pullNewUrl}\n`);
  process.stdout.write("\nTip: set BASE_BRANCH to override, e.g. BASE_BRANCH=feature/blue-green-canary\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[open-pr] ${message}\n`);
  process.exit(1);
}
