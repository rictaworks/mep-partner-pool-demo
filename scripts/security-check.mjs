import { execFileSync } from 'node:child_process';

const paths = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const sensitive = /(^|\/)(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|master\.key|.*\.(?:pem|p12|pfx))$/i;
for (const path of paths) {
  if (sensitive.test(path)) throw new Error('Sensitive filename staged; inspect the index before committing.');
  const text = execFileSync('git', ['show', `:${path}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/.test(text)) {
    throw new Error('Possible credential staged; inspect the index before committing.');
  }
}
// This is a narrow guard, not a credential scanner or a substitute for security review.
