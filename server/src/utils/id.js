'use strict';

const crypto = require('crypto');

function id(prefix) {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix ? `${prefix}_${rand}` : rand;
}

function orderId() {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `DB-${rand}`;
}

function vaultRef() {
  const num = 100000 + Math.floor(Math.random() * 900000);
  return `ESC-ZAR-${num}`;
}

function now() {
  return Date.now();
}

function nowIso() {
  return new Date().toISOString();
}

function zar(cents) {
  const val = Number(cents || 0) / 100;
  return `R ${val.toFixed(2)}`;
}

function toCents(rands) {
  if (typeof rands === 'string') {
    rands = parseFloat(rands.replace(/[^0-9.-]+/g, ''));
  }
  return Math.round(Number(rands || 0) * 100);
}

module.exports = {
  id,
  orderId,
  vaultRef,
  now,
  nowIso,
  zar,
  toCents,
};
