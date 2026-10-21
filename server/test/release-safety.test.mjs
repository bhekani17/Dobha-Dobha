import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(testDirectory, '..');
const repositoryDirectory = path.resolve(serverDirectory, '..');

describe('release safety', () => {
  it('does not expose an AWS deployment script for the legacy SAM stack', async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(serverDirectory, 'package.json'), 'utf8'),
    );

    assert.equal(packageJson.scripts['deploy:aws'], undefined);
  });

  it('keeps the build pipeline free of infrastructure deployment commands', async () => {
    const buildspec = await readFile(
      path.join(repositoryDirectory, 'buildspec.yml'),
      'utf8',
    );

    assert.doesNotMatch(
      buildspec,
      /\bsam\s+deploy\b|\baws\s+cloudformation\s+(?:create|update|delete)-stack\b|\baws\s+s3\s+sync\b/i,
    );
  });

  it('does not expire active listing media from the photos bucket', async () => {
    const template = await readFile(
      path.join(serverDirectory, 'infrastructure', 'template.yaml'),
      'utf8',
    );
    const photosBucket = template.split('  PhotosBucket:\n')[1]?.split('\n  WebsiteBucket:')[0];

    assert.ok(photosBucket, 'PhotosBucket resource should exist');
    assert.doesNotMatch(photosBucket, /^\s+ExpirationInDays:/m);
  });
});
