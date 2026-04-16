/**
 * team-config.js — TeamConfig loader, schema helpers, and validation
   *
 * Source of truth for team and agent definitions now lives in team-config.json.
 */

var DEFAULT_TEAM_CONFIG = {
  team: 'openclaw-office',
  title: 'OpenClaw Office',
  agents: [
    {
      id: 'pa',
      name: 'PERSONAL',
      kind: 'worker',
      role: 'General assistant',
      persona: 'Helpful general assistant for everyday tasks.',
      workspace: '~/.openclaw/workspace-personal',
      ai: {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        apiKeyEnv: 'GEMINI_API_KEY'
      },
      status: 'WORKING',
      stats: { tasks: 8, up: '14h', msg: 47, err: 0 },
      channels: [
        { name: 'Telegram', color: '#29b6f6' },
        { name: 'WhatsApp', color: '#25d366' }
      ],
      sprite: { hair: '#4e342e', skin: '#ffcc80', shirt: '#0d47a1', pants: '#263238' }
    },
    {
      id: 'wk',
      name: 'WORK',
      kind: 'worker',
      role: 'Email & calendar',
      persona: 'Organized office assistant focused on communications.',
      workspace: '~/.openclaw/workspace-work',
      ai: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        apiKeyEnv: 'DEEPSEEK_API_KEY'
      },
      status: 'WORKING',
      stats: { tasks: 11, up: '14h', msg: 63, err: 1 },
      channels: [
        { name: 'Slack', color: '#611f69' },
        { name: 'Telegram', color: '#29b6f6' }
      ],
      sprite: { hair: '#212121', skin: '#ffe0b2', shirt: '#4a148c', pants: '#1a237e' }
    },
    {
      id: 'op',
      name: 'OPS',
      kind: 'worker',
      role: 'Monitoring & alerts',
      persona: 'Operations agent focused on uptime and incidents.',
      workspace: '~/.openclaw/workspace-ops',
      ai: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKeyEnv: 'GEMINI_API_KEY'
      },
      status: 'IDLE',
      stats: { tasks: 5, up: '14h', msg: 32, err: 0 },
      channels: [
        { name: 'Discord', color: '#5865f2' },
        { name: 'Slack', color: '#611f69' }
      ],
      sprite: { hair: '#e65100', skin: '#ffd54f', shirt: '#1b5e20', pants: '#212121' }
    }
  ],
  schedules: [
    {
      id: 'daily-summary',
      name: 'Daily summary',
      enabled: false,
      cron: '0 18 * * *',
      target: 'pa'
    }
  ]
};

function _clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function _normalizeStatus(status) {
  return String(status || 'IDLE').toUpperCase();
}

function _normalizeAiConfig(agentConfig) {
  var ai = agentConfig && agentConfig.ai;
  if (ai && typeof ai === 'object') {
    return {
      provider: String(ai.provider || '').toLowerCase(),
      model: String(ai.model || ''),
      apiKeyEnv: String(ai.apiKeyEnv || '')
    };
  }
  return {
    provider: '',
    model: '',
    apiKeyEnv: ''
  };
}

function _statusClass(status) {
  var lower = String(status || 'idle').toLowerCase();
  if (lower === 'working') return 'st-working';
  if (lower === 'busy') return 'st-busy';
  return 'st-idle';
}

function validateTeamConfig(config) {
  var errors = [];
  var seen = {};
  var team = config && config.team;
  var agents = config && config.agents;
  var allowedProviders = { deepseek: true, gemini: true };

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push('Config must be an object.');
    return { valid: false, errors: errors };
  }

  if (!team || typeof team !== 'string') {
    errors.push('Config must include a string "team".');
  }

  if (!Array.isArray(agents) || agents.length === 0) {
    errors.push('Config must include at least one agent.');
  } else {
    agents.forEach(function (agent, index) {
      var prefix = 'agents[' + index + ']';
      if (!agent || typeof agent !== 'object') {
        errors.push(prefix + ' must be an object.');
        return;
      }
      if (!agent.id || typeof agent.id !== 'string') {
        errors.push(prefix + '.id is required.');
      } else if (seen[agent.id]) {
        errors.push('Agent ids must be unique. Duplicate id: ' + agent.id);
      } else {
        seen[agent.id] = true;
      }
      if (!agent.name || typeof agent.name !== 'string') {
        errors.push(prefix + '.name is required.');
      }
      if (!agent.role || typeof agent.role !== 'string') {
        errors.push(prefix + '.role is required.');
      }
      if (!Array.isArray(agent.channels) || agent.channels.length === 0) {
        errors.push(prefix + '.channels must contain at least one channel.');
      }
      if (!agent.sprite || typeof agent.sprite !== 'object') {
        errors.push(prefix + '.sprite is required.');
      }
      if (!agent.ai || typeof agent.ai !== 'object' || Array.isArray(agent.ai)) {
        errors.push(prefix + '.ai is required.');
      } else {
        if (!agent.ai.provider || typeof agent.ai.provider !== 'string') {
          errors.push(prefix + '.ai.provider is required.');
        } else if (!allowedProviders[String(agent.ai.provider).toLowerCase()]) {
          errors.push(prefix + '.ai.provider must be one of: deepseek, gemini.');
        }
        if (!agent.ai.model || typeof agent.ai.model !== 'string') {
          errors.push(prefix + '.ai.model is required.');
        }
        if (!agent.ai.apiKeyEnv || typeof agent.ai.apiKeyEnv !== 'string') {
          errors.push(prefix + '.ai.apiKeyEnv is required.');
        }
      }
    });
  }

  return { valid: errors.length === 0, errors: errors };
}

function buildAgentRecord(agentConfig) {
  var stats = agentConfig.stats || {};
  var status = _normalizeStatus(agentConfig.status);
  var ai = _normalizeAiConfig(agentConfig);
  return {
    id: agentConfig.id,
    name: agentConfig.name,
    kind: agentConfig.kind || 'worker',
    role: agentConfig.role,
    persona: agentConfig.persona || '',
    workspace: agentConfig.workspace || '',
    ai: ai,
    model: ai.model,
    status: status,
    stClass: _statusClass(status),
    tasks: stats.tasks || 0,
    up: stats.up || '0m',
    msg: stats.msg || 0,
    err: stats.err || 0,
    channels: (agentConfig.channels || []).map(function (channel) {
      return {
        name: channel.name,
        color: channel.color
      };
    }),
    sprite: _clone(agentConfig.sprite || {})
  };
}

function buildAgentMap(config) {
  var map = {};
  (config.agents || []).forEach(function (agent) {
    map[agent.id] = buildAgentRecord(agent);
  });
  return map;
}

function createAgentConfig(input, sprite) {
  var id = input.id || 'ag_' + Date.now();
  return {
    id: String(id).toLowerCase(),
    name: String(input.name || 'AGENT').toUpperCase(),
    kind: input.kind || 'worker',
    role: input.role || 'Custom agent',
    persona: input.persona || '',
    workspace: input.workspace || '',
    ai: {
      provider: String(input.aiProvider || 'gemini').toLowerCase(),
      model: input.aiModel || 'gemini-2.5-flash',
      apiKeyEnv: input.aiApiKeyEnv || 'GEMINI_API_KEY'
    },
    status: 'IDLE',
    stats: { tasks: 0, up: '0m', msg: 0, err: 0 },
    channels: [
      {
        name: input.channelName || 'Telegram',
        color: input.channelColor || '#4fc3f7'
      }
    ],
    sprite: _clone(sprite || {})
  };
}

function normalizeLoadedConfig(config) {
  var result = validateTeamConfig(config);
  if (!result.valid) {
    throw new Error(result.errors.join(' '));
  }
  return _clone(config);
}

function loadConfig(fetchImpl) {
  if (!fetchImpl) {
    return Promise.resolve(_clone(DEFAULT_TEAM_CONFIG));
  }
  return fetchImpl('team-config.json')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Failed to load team-config.json');
      }
      return response.json();
    })
    .then(function (config) {
      return normalizeLoadedConfig(config);
    })
    .catch(function () {
      return _clone(DEFAULT_TEAM_CONFIG);
    });
}

var TeamConfig = {
  DEFAULT_TEAM_CONFIG: DEFAULT_TEAM_CONFIG,
  validateTeamConfig: validateTeamConfig,
  normalizeLoadedConfig: normalizeLoadedConfig,
  buildAgentRecord: buildAgentRecord,
  buildAgentMap: buildAgentMap,
  createAgentConfig: createAgentConfig,
  loadConfig: loadConfig,
  statusClass: _statusClass
};

if (typeof window !== 'undefined') {
  window.TeamConfig = TeamConfig;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TeamConfig;
}
