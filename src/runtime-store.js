/**
 * runtime-store.js — canonical task/run store for the office UI
 *
 * This first slice keeps the control plane in-browser so the UI can move to
 * config-backed agents and a shared task/run lifecycle without adding a server.
 */

var TeamConfigApi = typeof module !== 'undefined' && module.exports
  ? require('./team-config.js')
  : TeamConfig;

var OfficeRuntimeStore = (function () {
  var _listeners = [];
  var _taskCounter = 0;
  var _runCounter = 0;
  var _state = _createEmptyState();

  function _createEmptyState() {
    return {
      teamConfig: null,
      agents: {},
      tasks: {},
      runs: [],
      logs: [],
      selectedAgentId: null
    };
  }

  function _clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function _getTeamConfigAgent(agentId) {
    var agents = (_state.teamConfig && _state.teamConfig.agents) || [];
    var i;
    for (i = 0; i < agents.length; i++) {
      if (agents[i].id === agentId) return agents[i];
    }
    return null;
  }

  function _notify() {
    _listeners.forEach(function (listener) {
      listener(getState());
    });
  }

  function _makeTimestamp() {
    return new Date().toISOString();
  }

  function _makeDisplayTime() {
    var n = new Date();
    var h = n.getHours() % 12 || 12;
    var m = String(n.getMinutes()).padStart(2, '0');
    var ap = n.getHours() >= 12 ? 'PM' : 'AM';
    return h + ':' + m + ' ' + ap;
  }

  function _makeTaskId() {
    _taskCounter += 1;
    return 'task_' + _taskCounter;
  }

  function _makeRunId() {
    _runCounter += 1;
    return 'run_' + _runCounter;
  }

  function init(teamConfig, initialLogs) {
    _state = _createEmptyState();
    _state.teamConfig = _clone(teamConfig);
    _state.agents = TeamConfigApi.buildAgentMap(teamConfig);
    _state.logs = _clone(initialLogs || []);
    _state.selectedAgentId = Object.keys(_state.agents)[0] || null;
    _notify();
    return getState();
  }

  function subscribe(listener) {
    _listeners.push(listener);
    return function unsubscribe() {
      _listeners = _listeners.filter(function (entry) {
        return entry !== listener;
      });
    };
  }

  function getState() {
    return _clone(_state);
  }

  function getAgents() {
    return _state.agents;
  }

  function getAgentIds() {
    return Object.keys(_state.agents);
  }

  function getAgent(agentId) {
    return _state.agents[agentId] || null;
  }

  function getSelectedAgentId() {
    return _state.selectedAgentId;
  }

  function setSelectedAgentId(agentId) {
    if (!_state.agents[agentId]) return false;
    _state.selectedAgentId = agentId;
    _notify();
    return true;
  }

  function getRuns() {
    return _clone(_state.runs);
  }

  function getLatestRun() {
    return _state.runs[0] ? _clone(_state.runs[0]) : null;
  }

  function getLogs() {
    return _clone(_state.logs);
  }

  function addLog(agent, msg) {
    _state.logs.unshift({
      ts: _makeDisplayTime(),
      agent: agent,
      msg: msg
    });
    _notify();
  }

  function normalizeTaskInput(input) {
    var payload = input || {};
    var requestedAgentId = payload.requestedAgentId || _state.selectedAgentId;
    var agent = getAgent(requestedAgentId);
    return {
      id: _makeTaskId(),
      sourceType: payload.sourceType || 'web-ui',
      sourceLabel: payload.sourceLabel || payload.sourceType || 'web-ui',
      command: String(payload.command || '').trim(),
      requestedAgentId: requestedAgentId,
      ai: _clone(payload.ai || (agent && agent.ai) || {}),
      scheduleId: payload.scheduleId || null,
      metadata: _clone(payload.metadata || {}),
      createdAt: _makeTimestamp()
    };
  }

  function createRunRecord(task) {
    return {
      id: _makeRunId(),
      taskId: task.id,
      agentId: task.requestedAgentId,
      sourceType: task.sourceType,
      ai: _clone(task.ai || {}),
      status: 'received',
      summary: '',
      createdAt: _makeTimestamp(),
      updatedAt: _makeTimestamp(),
      history: [
        {
          status: 'received',
          at: _makeTimestamp()
        }
      ]
    };
  }

  function _transitionRun(run, status, summary) {
    run.status = status;
    run.summary = summary || run.summary;
    run.updatedAt = _makeTimestamp();
    run.history.push({
      status: status,
      at: run.updatedAt
    });
  }

  function submitTask(input) {
    var task = normalizeTaskInput(input);
    var agent = getAgent(task.requestedAgentId);
    var run;
    var summary;

    if (!task.command) {
      throw new Error('Task command is required.');
    }

    if (!agent) {
      throw new Error('Requested agent does not exist: ' + task.requestedAgentId);
    }

    _state.tasks[task.id] = task;
    run = createRunRecord(task);
    _transitionRun(run, 'planned', 'Task accepted and waiting for execution.');
    _transitionRun(run, 'running', 'Task routed to ' + agent.name + '.');

    agent.status = 'WORKING';
    agent.stClass = TeamConfigApi.statusClass(agent.status);
    agent.tasks += 1;
    agent.msg += 1;

    if (task.metadata && task.metadata.gatewaySummary) {
      summary = String(task.metadata.gatewaySummary);
    } else {
      summary = 'Executed via ' + task.sourceType + ' [' + agent.ai.provider + '/' + agent.ai.model + ']: ' + task.command;
    }
    _transitionRun(run, 'completed', summary);

    _state.runs.unshift(run);
    addLog(agent.name, summary);
    return _clone(run);
  }

  function addAgent(agentConfig) {
    var validation = TeamConfigApi.validateTeamConfig({
      team: _state.teamConfig.team,
      agents: _state.teamConfig.agents.concat([agentConfig])
    });

    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    _state.teamConfig.agents.push(_clone(agentConfig));
    _state.agents[agentConfig.id] = TeamConfigApi.buildAgentRecord(agentConfig);
    _state.selectedAgentId = agentConfig.id;
    addLog(_state.agents[agentConfig.id].name, 'Agent added to runtime config.');
    return _clone(_state.agents[agentConfig.id]);
  }

  function updateAgent(agentId, patch) {
    var agent = _state.agents[agentId];
    var teamConfigAgent = _getTeamConfigAgent(agentId);
    if (!agent) return false;

    Object.keys(patch || {}).forEach(function (key) {
      agent[key] = _clone(patch[key]);
      if (teamConfigAgent) {
        teamConfigAgent[key] = _clone(patch[key]);
      }
    });

    if (patch && patch.status) {
      agent.stClass = TeamConfigApi.statusClass(patch.status);
    }
    if (patch && patch.ai) {
      agent.model = patch.ai.model;
    }

    _notify();
    return true;
  }

  function getTeamConfig() {
    return _clone(_state.teamConfig);
  }

  return {
    init: init,
    subscribe: subscribe,
    getState: getState,
    getTeamConfig: getTeamConfig,
    getAgents: getAgents,
    getAgentIds: getAgentIds,
    getAgent: getAgent,
    getSelectedAgentId: getSelectedAgentId,
    setSelectedAgentId: setSelectedAgentId,
    getRuns: getRuns,
    getLatestRun: getLatestRun,
    getLogs: getLogs,
    addLog: addLog,
    normalizeTaskInput: normalizeTaskInput,
    createRunRecord: createRunRecord,
    submitTask: submitTask,
    addAgent: addAgent,
    updateAgent: updateAgent
  };
})();

if (typeof window !== 'undefined') {
  window.OfficeRuntimeStore = OfficeRuntimeStore;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfficeRuntimeStore;
}
