import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checksFor, eventBase, planChecks } from './ci-plan.mjs';
test('UI, docs and version-only releases do not rebuild unchanged agents or Docker packaging', () => {
  assert.deepEqual(planChecks(['app/src/features/users/mcp-consent.tsx','docs/mcp.md','app/package.json']), { agent:false,image:false,application:true });
});
test('agent inputs require agent checks and image validation', () => {
  for(const path of ['agent/internal/agent/jobs.go','agent/go.mod','go.work','scripts/build-agent.mjs','scripts/agent-release.mjs']) assert.deepEqual(planChecks([path]),{agent:true,image:true,application:true},path);
});
test('packaging and dependency changes still validate the image', () => {
  for(const path of ['deploy/control-plane.Dockerfile','pnpm-lock.yaml','app/src/package/vite.ts','app/scripts/build-maintenance.mjs']) assert.deepEqual(planChecks([path]),{agent:false,image:true,application:true},path);
  assert.deepEqual(planChecks(['app/package.json'],{packageChanged:true}),{agent:false,image:true,application:true});
});

test('documentation-only commits run documentation checks without application builds', () => {
  assert.deepEqual(planChecks(['docs/index.md', 'docs/docs.json', 'README.md', 'app/README.md']), {agent:false,image:false,application:false});
  assert.equal(planChecks(['docs/index.md', '.github/workflows/ci.yml']).application, true);
});

const head = 'a'.repeat(40);
const base = 'b'.repeat(40);

test('manual dispatch without base or before still selects application jobs', () => {
  const event = { ref: 'refs/heads/cursor/external-deploy-admission-728c', inputs: null, workflow: 'CI' };
  assert.equal(eventBase(event), null);
  assert.deepEqual(checksFor(event, []), { agent: true, image: true, application: true });
  assert.equal(eventBase({ before: '0'.repeat(40) }), null);
});

test('pull_request and push keep their comparison base and path plan', () => {
  assert.equal(eventBase({ pull_request: { base: { sha: base } } }), base);
  assert.equal(eventBase({ before: head, after: base }), head);
  assert.deepEqual(
    checksFor({ pull_request: { base: { sha: base } } }, ['docs/index.md', 'README.md']),
    { agent: false, image: false, application: false },
  );
  assert.equal(checksFor({ before: head }, ['app/src/server/github/webhook-handler.ts']).application, true);
});
