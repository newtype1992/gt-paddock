import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carIdentity } from '../src/gt7-cars.js';

test('recorded Supra ID resolves to exact model and reference photo', () => {
  assert.equal(carIdentity(82).name, "Toyota Supra RZ '97");
  assert.equal(carIdentity('82').name, "Toyota Supra RZ '97");
  assert.match(carIdentity(82).image.url, /^https:\/\/www.gran-turismo.com\//);
});
test('unknown and simulation IDs do not imply a model match', () => {
  assert.equal(carIdentity(999999).image, null);
  assert.equal(carIdentity(999999).name, 'Unknown car (ID 999999)');
  assert.equal(carIdentity(null).name, 'No car detected');
  assert.equal(carIdentity(82, 'simulation').name, 'Simulation');
});
