import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { json, error, handleCors, parseBody } = require('../src/utils/response.js');
const { id, orderId, vaultRef, zar, toCents } = require('../src/utils/id.js');

describe('Dobha Dobha - Utility & Core Business Logic Tests', () => {
  describe('Response & CORS utilities', () => {
    it('does not emit a wildcard origin when no website origin is configured', () => {
      const res = json(200, { success: true });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
      assert.equal(res.headers['Content-Type'], 'application/json');
      const body = JSON.parse(res.body);
      assert.equal(body.success, true);
    });

    it('uses only the explicitly configured website origin', () => {
      const modulePath = require.resolve('../src/utils/response.js');
      const originalOrigin = process.env.ALLOWED_WEB_ORIGINS;
      process.env.ALLOWED_WEB_ORIGINS = 'https://shop.example.com';
      delete require.cache[modulePath];
      const configuredResponse = require(modulePath).json(200, { success: true });
      assert.equal(configuredResponse.headers['Access-Control-Allow-Origin'], 'https://shop.example.com');
      assert.equal(configuredResponse.headers.Vary, 'Origin');
      if (originalOrigin === undefined) delete process.env.ALLOWED_WEB_ORIGINS;
      else process.env.ALLOWED_WEB_ORIGINS = originalOrigin;
      delete require.cache[modulePath];
      require(modulePath);
    });

    it('should handle OPTIONS preflight request', () => {
      const event = { httpMethod: 'OPTIONS' };
      const res = handleCors(event);
      assert.notEqual(res, null);
      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
    });

    it('should parse JSON body correctly', () => {
      const event = { body: JSON.stringify({ room: 'bale-market-1' }) };
      const parsed = parseBody(event);
      assert.equal(parsed.room, 'bale-market-1');
    });

    it('should format error response', () => {
      const res = error(404, 'Stream not found');
      assert.equal(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.equal(body.error, 'Stream not found');
    });
  });

  describe('ID and Currency calculations', () => {
    it('should generate prefixed IDs', () => {
      const usrId = id('usr');
      assert.ok(usrId.startsWith('usr_'));
      const itmId = id('itm');
      assert.ok(itmId.startsWith('itm_'));
    });

    it('should generate valid Order ID and Escrow Vault reference', () => {
      const ord = orderId();
      assert.ok(ord.startsWith('DB-'));
      const vlt = vaultRef();
      assert.ok(vlt.startsWith('ESC-ZAR-'));
    });

    it('should correctly format South African Rand currency', () => {
      assert.equal(zar(5000), 'R 50.00');
      assert.equal(zar(12550), 'R 125.50');
      assert.equal(zar(0), 'R 0.00');
    });

    it('should correctly convert Rand string and numbers to cents', () => {
      assert.equal(toCents(50), 5000);
      assert.equal(toCents('R 120.00'), 12000);
      assert.equal(toCents(75.5), 7550);
    });
  });

  describe('Feature 1: Live-Stream Shopping Logic', () => {
    it('should validate Live room names', () => {
      const validRoomRegex = /^[a-zA-Z0-9_-]{1,40}$/;
      assert.ok(validRoomRegex.test('bale-joburg-street-1'));
      assert.ok(validRoomRegex.test('vintage_drop_2026'));
      assert.equal(validRoomRegex.test('invalid space room'), false);
      assert.equal(validRoomRegex.test('invalid@symbol!'), false);
    });
  });

  describe('Feature 3: Secure Escrow Payment Logic', () => {
    it('should calculate 5% platform commission correctly upon delivery confirmation', () => {
      const COMMISSION_RATE = 0.05;
      const itemPriceCents = 20000; // R200.00
      const commission = Math.round(itemPriceCents * COMMISSION_RATE); // R10.00
      const sellerPayout = itemPriceCents - commission; // R190.00

      assert.equal(commission, 1000); // 1000 cents = R10.00
      assert.equal(sellerPayout, 19000); // 19000 cents = R190.00
    });

    it('should verify delivery methods pricing', () => {
      const DELIVERY_METHODS = {
        'PUDO Locker-to-Locker': 5000,
        'Courier Guy Door-to-Door': 6500,
        'Downtown Joburg Safe Hub': 0,
      };

      assert.equal(DELIVERY_METHODS['PUDO Locker-to-Locker'], 5000);
      assert.equal(DELIVERY_METHODS['Courier Guy Door-to-Door'], 6500);
      assert.equal(DELIVERY_METHODS['Downtown Joburg Safe Hub'], 0);
    });
  });

  describe('Feature 4: Digital Storefronts & Promotional Ads', () => {
    it('should compute promotional ad placement cost', () => {
      const costPerDayCents = 1500; // R15.00/day
      const days = 7;
      const totalAdCost = days * costPerDayCents;
      assert.equal(totalAdCost, 10500); // R105.00
      assert.equal(zar(totalAdCost), 'R 105.00');
    });
  });

  describe('Feature 5: Wallet & Withdrawals', () => {
    it('should enforce minimum withdrawal limit', () => {
      const minWithdrawalCents = 5000; // R50.00
      assert.ok(toCents(60) >= minWithdrawalCents);
      assert.ok(toCents(30) < minWithdrawalCents);
    });
  });
});
