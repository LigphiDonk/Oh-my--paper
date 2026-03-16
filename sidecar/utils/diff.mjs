/**
 * Simple line-level diff using LCS (Longest Common Subsequence).
 * Produces an array of diff lines for rendering.
 */

/**
 * @param {string} oldContent
 * @param {string} newContent
 * @returns {Array<{ type: "add"|"remove"|"equal", content: string, oldLine?: number, newLine?: number }>}
 */
export function computeDiff(oldContent, newContent) {
  const oldLines = (oldContent || "").split("\n");
  const newLines = (newContent || "").split("\n");

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;

  // Optimize: if identical, return all equal
  if (oldContent === newContent) {
    return oldLines.map((line, i) => ({
      type: "equal",
      content: line,
      oldLine: i + 1,
      newLine: i + 1,
    }));
  }

  // Use O(n) space LCS
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);

  // We need the full table for backtracking, so use a compact approach
  // For files up to ~2000 lines this is fine
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Uint16Array(n + 1);
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result = [];
  let i = m;
  let j = n;

  const stack = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "equal", content: oldLines[i - 1], oldLine: i, newLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "add", content: newLines[j - 1], newLine: j });
      j--;
    } else {
      stack.push({ type: "remove", content: oldLines[i - 1], oldLine: i });
      i--;
    }
  }

  stack.reverse();
  return stack;
}

/**
 * Compute diff statistics.
 * @param {Array} diffLines - Output from computeDiff
 * @returns {{ additions: number, deletions: number }}
 */
export function diffStats(diffLines) {
  let additions = 0;
  let deletions = 0;
  for (const line of diffLines) {
    if (line.type === "add") additions++;
    else if (line.type === "remove") deletions++;
  }
  return { additions, deletions };
}
