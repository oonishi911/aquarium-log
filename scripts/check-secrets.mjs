// コミット予定のファイルに APIキー・パスワードなどが含まれていないか検査する。
// 使い方: npm run check-secrets（ステージ済みファイル） / npm run check-secrets -- --all（追跡中の全ファイル）
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const all = process.argv.includes('--all');
const cmd = all ? 'git ls-files' : 'git diff --cached --name-only --diff-filter=ACM';
const files = execSync(cmd, { encoding: 'utf8' }).split('\n').filter(Boolean);

const patterns = [
  ['秘密鍵', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['OpenAI/Anthropic 系キー', /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/],
  ['Google APIキー', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub トークン', /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/],
  ['AWS アクセスキー', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack トークン', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['キー・パスワードの直書き', /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
];
const blockedFiles = [/(^|\/)\.env(\.|$)(?!example)/, /\.(pem|key)$/];

const findings = [];
for (const file of files) {
  if (file === 'scripts/check-secrets.mjs') continue;
  if (blockedFiles.some((re) => re.test(file))) findings.push(`${file}: 秘密情報用のファイルです`);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const [label, re] of patterns) {
      if (re.test(line)) findings.push(`${file}:${i + 1}: ${label} の可能性`);
    }
  });
}

console.log(`検査したファイル: ${files.length} 件`);
if (findings.length) {
  console.error('秘密情報の可能性があります:\n' + findings.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('秘密情報らしき文字列は見つかりませんでした。');
