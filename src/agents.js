/**
 * agents.js — transitional seed data for the office UI
 *
 * Team and agent definitions now live in team-config.json. This file only keeps
 * demo logs and sprite helpers while the UI migrates to the new control-plane
 * model.
 */

/** Initial activity log entries */
var INITIAL_LOG = [
  { ts: '08:04 PM', agent: 'WORK',     msg: 'sent weekly report via Slack' },
  { ts: '07:46 PM', agent: 'PERSONAL', msg: 'booked restaurant via Telegram' },
  { ts: '07:22 PM', agent: 'OPS',      msg: 'CPU spike detected — alert sent to Discord' }
];

/** Sprite colours for freshly added agents (cycles through this list) */
var NEW_AGENT_SPRITES = [
  { hair: '#37474f', skin: '#ffcc80', shirt: '#004d40', pants: '#263238' },
  { hair: '#880e4f', skin: '#ffe0b2', shirt: '#bf360c', pants: '#212121' },
  { hair: '#0d47a1', skin: '#ffd54f', shirt: '#1a237e', pants: '#37474f' }
];
var _spriteIdx = 0;
function nextSprite() { return NEW_AGENT_SPRITES[_spriteIdx++ % NEW_AGENT_SPRITES.length]; }
