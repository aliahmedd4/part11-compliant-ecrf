'use strict';

const Subject = require('../models/subject.model');
const FormInstance = require('../models/formInstance.model');
const Signature = require('../models/signature.model');
const { sha256 } = require('../lib/hash');
const { serverNow } = require('../lib/time');

/**
 * Dataset export with an integrity checksum manifest.
 *
 * REGULATORY REASONING (ALCOA+ "Accurate/Consistent"; 11.10(c) protect records):
 * When data leaves the controlled system (e.g. for statistical analysis) its
 * integrity must remain verifiable. We emit each dataset file alongside a SHA-256
 * checksum; a recipient can re-hash the file and confirm it was not altered in
 * transit or storage. The manifest itself records who exported, when (server
 * time), and the checksums — a portable proof of integrity.
 *
 * Returns an object of named files plus a checksums manifest; the route decides
 * how to deliver them.
 */
async function buildExport({ actor }) {
  // Deterministic order (by _id) so identical data always serializes to identical
  // bytes — the checksum manifest is only meaningful if the export is reproducible.
  const subjects = await Subject.find({}).sort({ _id: 1 }).lean();
  const forms = await FormInstance.find({}).sort({ _id: 1 }).lean();
  const signatures = await Signature.find({}).sort({ _id: 1 }).lean();

  const dataset = { subjects, forms, signatures };
  const generatedAtUTC = serverNow().toISOString();

  // JSON representation.
  const jsonContent = JSON.stringify({ generatedAtUTC, exportedBy: actor.username, dataset }, null, 2);

  // CSV representation of the (flat) form data — one row per form.
  const csvContent = formsToCsv(forms);

  const files = {
    'dataset.json': jsonContent,
    'forms.csv': csvContent,
  };

  // Build the checksum manifest.
  const checksums = Object.entries(files)
    .map(([name, content]) => `${sha256(content)}  ${name}`)
    .join('\n');
  files['checksums.txt'] = `${checksums}\n`;

  return {
    files,
    manifest: {
      generatedAtUTC,
      exportedBy: actor.username,
      algorithm: 'SHA-256',
      checksums: Object.fromEntries(
        Object.entries(files)
          .filter(([name]) => name !== 'checksums.txt')
          .map(([name, content]) => [name, sha256(content)])
      ),
    },
  };
}

function formsToCsv(forms) {
  const header = ['formId', 'subjectId', 'visitId', 'type', 'version', 'status', 'locked', 'data'];
  const rows = forms.map((f) => [
    String(f._id),
    String(f.subjectId),
    String(f.visitId),
    f.type,
    f.version,
    f.status,
    f.locked,
    JSON.stringify(f.data || {}).replace(/"/g, '""'),
  ]);
  return [header, ...rows]
    .map((cols) => cols.map((c) => `"${String(c)}"`).join(','))
    .join('\n');
}

module.exports = { buildExport };
