import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLease, decideProbe, classifyResponse, completionRequest, sanitizedEvent } from '../n8n/recovery-coordination/guard.mjs';
const token = 'f83111e1-b7da-4d69-9717-161441a814f5';
const valid = { granted:true, lease_token:token, retry_after:'2026-11-05T11:00:00.000Z' };
const now = Date.parse('2026-11-05T10:30:00.000Z');
test('deny missing, malformed and refused claim', () => {
  assert.equal(validateLease(null, now).allowed, false);
  assert.equal(validateLease({granted:false,lease_token:token},now).allowed,false);
  assert.equal(validateLease({granted:true,lease_token:'bad',retry_after:valid.retry_after},now).allowed,false);
});
test('grant only one query with adequate lease duration', () => {
  const d=decideProbe([valid],[{search_query:'wordpress help'},{search_query:'shopify'}],now);
  assert.equal(d.authorized,true); assert.equal(d.query.search_query,'wordpress help');
  assert.equal(decideProbe(valid,[{search_query:'x'}],now,31*60*1000).authorized,false);
  assert.equal(decideProbe(valid,[],now).authorized,false);
});
test('expired claims and stale data are rejected', () => assert.equal(validateLease(valid, now+31*60*1000).allowed,false));
test('429 is rate-limit, not automatically monthly quota', () => {
  assert.equal(classifyResponse({statusCode:429,error:{message:'Too many requests'}}).category,'rate_limit');
  assert.equal(classifyResponse({error:{message:'monthly quota exhausted'}}).category,'quota');
});
test('safe completion and event never include original payload', () => {
  const r=classifyResponse({statusCode:429,error:{message:'Too many requests key=SECRET'}});
  assert.equal(completionRequest('serpapi',token,r).p_failure_code,429);
  const event=sanitizedEvent('serpapi','google','ws','run',r);
  assert.equal(JSON.stringify(event).includes('SECRET'),false);
  assert.equal(event.outcome,'failed');
});
