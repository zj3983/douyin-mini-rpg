export function canvasHealth(stats) {
  const coloredPixels = Number(stats.coloredPixels) || 0
  const uniqueColors = Number(stats.uniqueColors) || 0
  const diffRatio = Number(stats.diffRatio) || 0
  const detail = `colored=${coloredPixels} unique=${uniqueColors} motion=${(diffRatio * 100).toFixed(2)}%`
  return {
    ok: coloredPixels >= 5000 && uniqueColors >= 24 && diffRatio >= 0.002,
    detail,
  }
}

export function summarizeAgentRun({ checks, consoleIssues, pageErrors, requestFailures }) {
  const lines = []
  let passed = 0
  let failed = 0

  for (const check of checks) {
    if (check.ok) {
      passed += 1
      lines.push(`PASS ${check.name}${check.detail ? ` - ${check.detail}` : ''}`)
    } else {
      failed += 1
      lines.push(`FAIL ${check.name}${check.detail ? ` - ${check.detail}` : ''}`)
    }
  }

  for (const issue of consoleIssues) {
    failed += 1
    lines.push(`FAIL console ${issue.type}: ${issue.text}`)
  }
  for (const error of pageErrors) {
    failed += 1
    lines.push(`FAIL page error: ${error}`)
  }
  for (const failure of requestFailures) {
    failed += 1
    lines.push(`FAIL request: ${failure}`)
  }

  return {
    ok: failed === 0,
    passed,
    failed,
    lines,
  }
}

export function reportMarkdown({ startedAt, durationMs, baseUrl, viewport, checks, consoleIssues, pageErrors, requestFailures, screenshots, performance }) {
  const summary = summarizeAgentRun({ checks, consoleIssues, pageErrors, requestFailures })
  const lines = [
    '# Game Agent Report',
    '',
    `- Started: ${startedAt}`,
    `- Duration: ${(durationMs / 1000).toFixed(1)}s`,
    `- Target: ${baseUrl}`,
    `- Viewport: ${viewport.width}x${viewport.height}`,
    `- Status: ${summary.ok ? 'PASS' : 'FAIL'}`,
    `- Checks: ${summary.passed} passed, ${summary.failed} failed`,
    '',
    '## Checks',
    '',
    ...summary.lines.map((line) => `- ${line}`),
    '',
    '## Performance',
    '',
    `- Average frame interval: ${performance.averageFrameMs.toFixed(2)} ms`,
    `- Slow frames over 50ms: ${performance.slowFrames}`,
    '',
    '## Screenshots',
    '',
    ...screenshots.map((shot) => `- ${shot.label}: ${shot.file}`),
    '',
  ]
  return { summary, markdown: lines.join('\n') }
}
