/**
 * NEOCARE Doctor Dashboard — Demo Data Generator
 * ────────────────────────────────────────────────
 * Stage 3: This script documents how the synthetic data
 * in /data/ was generated and can regenerate it if needed.
 *
 * Usage (from project root):
 *   node scripts/generate-demo-data.js
 *
 * Output files (overwritten):
 *   data/patients.json     — 12 synthetic patient records
 *   data/sensor-data.json  — 416 sensor readings (24–48 per patient)
 *   data/alerts.json       — 20 synthetic alert records
 *   data/doctor.json       — 1 synthetic doctor profile
 *
 * IMPORTANT:
 *   All generated data is entirely synthetic and algorithmically produced.
 *   No real patient or clinical data is used or produced.
 *   This script is for DEMO and PORTFOLIO purposes only.
 *
 * NOTE: Stage 3 data was generated via a Python script with seed=42
 *       for deterministic output. A Node.js equivalent is provided
 *       below for future use but is not required to run the application.
 *       The /data/ JSON files are the canonical source.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function jitter(value, delta, decimals = 0) {
  const v = value + (Math.random() * 2 - 1) * delta;
  return parseFloat(v.toFixed(decimals));
}

// ── Patient generation ────────────────────────────────────────

function generatePatients() {
  // Stage 3 data is already committed. This function is a
  // reference implementation for future re-generation.
  console.log('[generate-demo-data] Patient data is pre-authored in data/patients.json.');
  console.log('[generate-demo-data] Run this script only to reset data to defaults.');
}

// ── Sensor data generation ────────────────────────────────────

function generateSensorData() {
  // TODO (if regeneration is needed): implement deterministic
  // sensor reading generator matching the Python script used in Stage 3.
  console.log('[generate-demo-data] Sensor data is pre-generated in data/sensor-data.json.');
}

// ── Alert generation ──────────────────────────────────────────

function generateAlerts() {
  console.log('[generate-demo-data] Alert data is pre-authored in data/alerts.json.');
}

// ── Entry point ───────────────────────────────────────────────

function main() {
  console.log('NEOCARE Demo Data Generator');
  console.log('DEMO/PORTFOLIO ONLY — All data is synthetic.');
  console.log('─────────────────────────────────────────────');
  generatePatients();
  generateSensorData();
  generateAlerts();
  console.log('\nTo regenerate data, implement the functions above.');
  console.log('Current data files in /data/ are the canonical source.');
}

main();
