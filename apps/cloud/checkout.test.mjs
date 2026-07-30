// The checkout decisions — Cloud Phase 14.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkoutSessionParams,
  deriveProjectId,
  validProjectId,
  validateNewProject,
} from './checkout.mjs';
import { loadPricing } from './pricing.mjs';

const pricing = loadPricing();

describe('deriveProjectId', () => {
  it('folds a human name into an address', () => {
    assert.equal(deriveProjectId('Brno Alligators'), 'brno-alligators');
  });
  it('folds diacritics rather than dropping them', () => {
    assert.equal(deriveProjectId('Zkušební tým Dovrtěl'), 'zkusebni-tym-dovrtel');
  });
  it('never emits leading, trailing, or doubled dashes', () => {
    assert.equal(deriveProjectId('  --Weird---  name!!  '), 'weird-name');
  });
});

describe('validProjectId', () => {
  it('accepts the ordinary case', () => {
    assert.equal(validProjectId('brno-alligators'), true);
  });
  it('refuses reserved names and the share-view namespace wholesale', () => {
    assert.equal(validProjectId('cloud'), false);
    assert.equal(validProjectId('www'), false);
    assert.equal(validProjectId('view-anything'), false);
  });
  it('refuses what DNS would refuse', () => {
    assert.equal(validProjectId('ab'), false);
    assert.equal(validProjectId('-x-'), false);
    assert.equal(validProjectId('a'.repeat(41)), false);
    assert.equal(validProjectId('Ahoj'), false);
  });
});

describe('validateNewProject', () => {
  it('passes a real submission through with the derived id', () => {
    const v = validateNewProject({
      name: 'Brno Alligators',
      plan: 'project',
      interval: 'monthly',
      pricing,
    });
    assert.deepEqual(v, {
      ok: true,
      id: 'brno-alligators',
      name: 'Brno Alligators',
      plan: 'project',
      interval: 'monthly',
    });
  });
  it('refuses an unknown plan, a bad interval, a hopeless name', () => {
    assert.equal(
      validateNewProject({ name: 'ok name', plan: 'nope', interval: 'monthly', pricing }).ok,
      false
    );
    assert.equal(
      validateNewProject({ name: 'ok name', plan: 'project', interval: 'weekly', pricing }).ok,
      false
    );
    assert.equal(
      validateNewProject({ name: '!!', plan: 'project', interval: 'monthly', pricing }).ok,
      false
    );
  });
});

describe('checkoutSessionParams', () => {
  const params = checkoutSessionParams({
    projectId: 'brno-alligators',
    projectName: 'Brno Alligators',
    plan: 'project',
    priceId: 'price_x',
    trialDays: 14,
    customerId: 'cus_1',
    origin: 'https://cloud.maude.sh',
  });

  it('starts a TRIAL subscription — nothing chargeable at checkout', () => {
    assert.equal(params.mode, 'subscription');
    assert.equal(params['subscription_data[trial_period_days]'], '14');
  });
  it('still collects and validates the card — that is the authorization', () => {
    assert.equal(params.payment_method_collection, 'always');
  });
  it('carries everything the return needs to CREATE the project row', () => {
    assert.equal(params['metadata[project_id]'], 'brno-alligators');
    assert.equal(params['metadata[project_name]'], 'Brno Alligators');
    assert.equal(params['metadata[plan]'], 'project');
  });
  it('returns to the waiting room, cancels back to the wizard', () => {
    assert.match(
      params.success_url,
      /\/checkout\/return\?project=brno-alligators&session_id=\{CHECKOUT_SESSION_ID\}/
    );
    assert.match(params.cancel_url, /\/projects\/new$/);
  });
});
