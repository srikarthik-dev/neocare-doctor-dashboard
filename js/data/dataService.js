/**
 * NEOCARE Doctor Dashboard — Data Service (Data Access Layer)
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   - Act as the single source of truth for all data access
 *     throughout the application.
 *   - In the demo stage: fetch JSON from the /data/ directory
 *     and return plain JavaScript objects.
 *   - In the production stage: replace fetch calls with
 *     Firebase Firestore SDK calls — no other modules change.
 *
 * Exposed API (to be implemented in a later stage):
 *   getPatients()          → Promise<Patient[]>
 *   getPatientById(id)     → Promise<Patient>
 *   getSensorData(id)      → Promise<SensorReading[]>
 *   getAlerts()            → Promise<Alert[]>
 *   getAlertsByPatient(id) → Promise<Alert[]>
 *
 * DEMO NOTE:
 *   All data returned is synthetic and for demonstration only.
 *   No real patient data is stored or transmitted.
 *
 * NOTE: Implementation is planned for a later stage.
 *       This file is a placeholder for the scaffolding.
 */

// TODO (Stage 3): Implement getPatients() — fetch /data/patients.json.
// TODO (Stage 3): Implement getPatientById(id).
// TODO (Stage 3): Implement getSensorData(id) — fetch /data/sensor-data.json.
// TODO (Stage 3): Implement getAlerts() — fetch /data/alerts.json.
// TODO (Stage 3): Implement getAlertsByPatient(id).
// TODO (Future):  Replace fetch calls with Firebase Firestore queries.
