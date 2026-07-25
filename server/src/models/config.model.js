'use strict';

const mongoose = require('mongoose');

/**
 * Config — a singleton holding the runtime-tunable Part 11 controls (password
 * policy, account lockout, session timeout). Making these configurable (rather
 * than hard-coded) lets an Administrator adjust controls under change control
 * without a code release, while the values remain enforced server-side.
 *
 * Access it via getConfig(), which lazily seeds the singleton from
 * config.defaultPolicy on first use.
 */
const configSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'GLOBAL', unique: true },
    passwordPolicy: {
      minLength: { type: Number, required: true },
      requiredClasses: { type: Number, required: true },
      historyDepth: { type: Number, required: true },
    },
    lockout: {
      threshold: { type: Number, required: true },
      windowMinutes: { type: Number, required: true },
      lockMinutes: { type: Number, required: true },
    },
    session: {
      idleTimeoutMinutes: { type: Number, required: true },
      warnBeforeMinutes: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

const Config = mongoose.model('Config', configSchema);

/**
 * Get the singleton config, seeding it from defaults on first access.
 * @param {object} defaultPolicy config.defaultPolicy
 * @returns {Promise<object>} the Config document
 */
async function getConfig(defaultPolicy) {
  let doc = await Config.findOne({ singletonKey: 'GLOBAL' });
  if (!doc) {
    doc = await Config.create({ singletonKey: 'GLOBAL', ...defaultPolicy });
  }
  return doc;
}

module.exports = Config;
module.exports.getConfig = getConfig;
