const Slack = require('node-slackr');
const async = require('async');
const debug = require('debug')('pagerduty-overrides:notifications');
const pdApi = require('./pagerduty-api');

function toISOstring(moment) {
  return moment.format('ddd, D MMM YYYY HH:mm:ss z');
}

function createPagerDutyIncident(options, message, cb) {
  debug(`Creating PD incident ${JSON.stringify(message)} with options ${JSON.stringify(options)}`);

  if (!options.pdToken || !options.serviceId || !options.from) {
    return cb(new Error("Missing PAGERDUTY settings (you'll need PAGERDUTY_TOKEN, PAGERDUTY_SERVICE_ID and PAGERDUTY_FROM)"));
  }

  if (!message.userId && !options.escalationPolicyId) {
    return cb(new Error('No userId or escalation policy specified'));
  }
  const incident = {
    type: 'incident',
    title: 'On-call overlap found!',
    service: {
      id: options.serviceId,
      type: 'service_reference',
    },
    body: {
      type: 'incident_body',
      details: message.messages.join('\n'),
    },
  };

  if (options.escalationPolicyId) {
    incident.escalationPolicy = {
      id: options.escalationPolicyId,
      type: 'escalation_policy_reference',
    };
  } else {
    incident.assignments = [{
      assignee: {
        id: message.userId,
        type: 'user_reference',
      },
    },
    ];
  }

  const incidentOptions = {
    method: 'POST',
    json: {
      incident,
    },
    headers: {
      From: options.from,
      Authorization: `Token token=${options.pdToken}`,
    },
  };

  return pdApi.send('/incidents', incidentOptions, (err, res, body) => {
    let error = err;
    if (!error && body && body.errors && body.errors.length > 0) {
      error = new Error(`INCIDENT_CREATION_FAILED Errors: ${JSON.stringify(body.errors)}`);
    } else if (!error && res && !(res.statusCode === 200 || res.statusCode === 201)) {
      error = new Error(`INCIDENT_CREATION_FAILED Creating incident failed with status ${res.statusCode}. Returned body: ${JSON.stringify(body)}`);
    }
    if (error) {
      debug('INCIDENT_CREATION_FAILED: ', error);
    }
    return cb(error);
  });
}

// https://www.npmjs.com/package/node-slackr
function createSlackMessage(options, message, cb) {
  if (options.webhookUrl) {
    const slack = new Slack(options.webhookUrl);
    return slack.notify(message, (err, result) => {
      if (err) {
        console.error('SLACK_SEND_MESSAGE_FAILED:', err);
        return cb(err);
      }
      return cb(null, result);
    });
  }
  return cb(new Error('Missing Slack webhook URL.'));
}

// Input is array of messages is we have more overlaps
function formatMessage(messages, option = 'plain') {
  let outputMessage;
  if (typeof messages === 'string') {
    return messages;
  }
  switch (option) {
    case 'plain':
      outputMessage = '_Following overlaps found:_\n';
      messages.forEach((message) => {
        outputMessage += `${message.user}: ${message.schedules[0]} and ${message.schedules[1]} (from ${toISOstring(message.overlapStart)} to ${toISOstring(message.overlapEnd)})\n`;
      });
      break;
    case 'markdown':
      outputMessage = 'Following overlaps found:\n';
      messages.forEach((message) => {
        outputMessage += `*${message.user}:* \`${message.schedules[0]}\` and \`${message.schedules[1]}\` (from ${toISOstring(message.overlapStart)} to ${toISOstring(message.overlapEnd)})\n`;
      });
      break;
    case 'json':
      outputMessage = messages.reduce((acc, curr) => {
        if (acc[curr.userId] == null) { acc[curr.userId] = {}; }
        if (acc[curr.userId].userId == null) { acc[curr.userId].userId = curr.userId; }
        if (acc[curr.userId].user == null) { acc[curr.userId].user = curr.user; }
        if (acc[curr.userId].messages == null) { acc[curr.userId].messages = []; }
        acc[curr.userId].messages.push(`${curr.schedules[0]} and ${curr.schedules[1]} (from ${toISOstring(curr.overlapStart)} to ${toISOstring(curr.overlapEnd)})`);
        return acc;
      },
      {});
      break;
    default:
      console.error(`Unsupported option ${option} used.`);
  }


  debug('Notification - formatMessage option: ', option);
  debug('Notification - formatMessage: ', outputMessage);
  return outputMessage;
}

function send(options, message, cb) {
  debug('send:', options, message);

  return async.parallel([
    function sendSlack(next) {
      if (options.SLACK || (options.SLACK_WEBHOOK_URL)) {
        debug('Found Slack webhook, sending a notification');
        const slackMessage = {};
        const slackOptions = {};
        slackMessage.text = formatMessage(message, 'markdown');
        if (options.SLACK) {
          slackMessage.channel = options.SLACK.CHANNEL;
          slackOptions.webhookUrl = options.SLACK.SLACK_WEBHOOK_URL;
        }
        if (!slackOptions.webhookUrl) { slackOptions.webhookUrl = options.SLACK_WEBHOOK_URL; }
        return createSlackMessage(slackOptions, slackMessage, next);
      }
      debug('No Slack webhook defined');
      return next();
    },
    function sendPagerDuty(next) {
      if (!((options.PAGERDUTY && options.PAGERDUTY.PAGERDUTY_TOKEN) || options.PAGERDUTY_TOKEN)) {
        debug('No PAGERDUTY token defined');
      } else if (options.PAGERDUTY.PAGERDUTY_SERVICE_ID && options.PAGERDUTY.PAGERDUTY_FROM) {
        debug('Found PD token - creating an incident');
        const pdOptions = {};
        pdOptions.pdToken = options.PAGERDUTY.PAGERDUTY_TOKEN || options.PAGERDUTY_TOKEN;
        pdOptions.serviceId = options.PAGERDUTY.PAGERDUTY_SERVICE_ID;
        pdOptions.escalationPolicyId = options.PAGERDUTY.PAGERDUTY_ESCALATION_POLICY_ID;
        pdOptions.from = options.PAGERDUTY != null ? options.PAGERDUTY.PAGERDUTY_FROM : undefined;
        const messagesByUser = formatMessage(message, 'json');
        return async.each(messagesByUser,
          (item, pdCb) => createPagerDutyIncident(pdOptions, item, pdCb),
          err => next(err));
      }
      console.log(`No PD options defined or defined incorrectly (${JSON.stringify(options.PAGERDUTY)})`);
      return next();
    },
  ], (err, results) => {
    if (err) { return cb(err); }
    const output = results.filter(n => n !== undefined);
    return cb(null, output);
  });
}

module.exports = {
  send,
  toISOstring,
};
