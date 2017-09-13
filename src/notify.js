/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Slack     = require('node-slackr');
const nconf     = require('nconf');
const async     = require('async');
const request   = require('request');
const debug     = require('debug')('pagerduty-overrides:notifications');
const pdApi    = require('./pagerduty-api');

const createPagerDutyIncident = function(options, message, cb) {
  debug(`Creating PD incident ${JSON.stringify(message)} with options ${JSON.stringify(options)}`);

  if (!options.pdToken || !options.serviceId || !options.from) {
    cb(new Error("Missing PAGERDUTY settings (you'll need PAGERDUTY_TOKEN, PAGERDUTY_SERVICE_ID and PAGERDUTY_FROM)"));
  }

  if (!message.userId && !options.escalationPolicyId) {
    return cb(new Error("No userId or escalation policy specified"));

  } else {
    const incident = {
      type: "incident",
      title: "On-call overlap found!",
      service: {
        id: options.serviceId,
        type: "service_reference"
      },
      body: {
        type: "incident_body",
        details: message.messages.join('\n')
      }
    };

    if (options.escalationPolicyId) {
      incident.escalationPolicy = {
        id: options.escalationPolicyId,
        type: "escalation_policy_reference"
      };
    } else {
      incident.assignments = [{
        assignee : {
          id: message.userId,
          type: "user_reference"
        }
      }
      ];
    }

    const incidentOptions = {
      method: "POST",
      json: {
        incident
      },
      headers: {
        From: options.from,
        Authorization: `Token token=${options.pdToken}`
      }
    };

    return pdApi.send('/incidents', incidentOptions, function(err, res, body) {
      if (__guard__(body != null ? body.errors : undefined, x => x.length) > 0) {
        if (err == null) { err = new Error(`INCIDENT_CREATION_FAILED Errors: ${JSON.stringify(body.errors)}`); }
      }
      if (((res != null ? res.statusCode : undefined) !== 200) && ((res != null ? res.statusCode : undefined) !== 201)) {
        if (err == null) { err = new Error(`INCIDENT_CREATION_FAILED Creating incident failed with status ${res.statusCode}. Returned body: ${JSON.stringify(body)}`); }
      }
      if (err) {
        debug("INCIDENT_CREATION_FAILED: ", err);
      }
      return cb(err);
    });
  }
};

// https://www.npmjs.com/package/node-slackr
const createSlackMessage = function(options, message, cb) {
  if (options.webhookUrl) {
    const slack = new Slack(options.webhookUrl);
    return slack.notify(message, function(err, result) {
      if (err) {
        console.error("SLACK_SEND_MESSAGE_FAILED:", err);
        return cb(err);
      }
      return cb(null, result);
    });
  } else {
    return cb(new Error("Missing Slack webhook URL."));
  }
};

// Input is array of messages is we have more overlaps
const formatMessage = function(messages, option) {
  let outputMessage;
  if (option == null) { option = 'plain'; }
  if (typeof messages === 'string') {
    return messages;
  } else {
    switch (option) {
      case 'plain':
        outputMessage = "_Following overlaps found:_\n";
        for (var message of Array.from(messages)) {
          outputMessage += `${message.user}: ${message.schedules[0]} and ${message.schedules[1]} (the first starting on ${message.date.toUTCString()}, the second on ${message.crossDate.toUTCString()})\n`;
        }
        break;
      case 'markdown':
        outputMessage = "Following overlaps found:\n";
        for (message of Array.from(messages)) {
          outputMessage += `*${message.user}:* \`${message.schedules[0]}\` and \`${message.schedules[1]}\` (the first starting on ${message.date.toUTCString()}, the second on ${message.crossDate.toUTCString()})\n`;
        }
        break;
      case 'json':
        outputMessage = messages.reduce(function(acc, curr){
          if (acc[curr.userId] == null) { acc[curr.userId] = {}; }
          if (acc[curr.userId].userId == null) { acc[curr.userId].userId = curr.userId; }
          if (acc[curr.userId].user == null) { acc[curr.userId].user = curr.user; }
          if (acc[curr.userId].messages == null) { acc[curr.userId].messages = []; }
          acc[curr.userId].messages.push(`${curr.schedules[0]} and ${curr.schedules[1]} (the first starting on ${curr.date.toUTCString()}, the second on ${curr.crossDate.toUTCString()})`);
          return acc;
        }
        , {});
        break;
    }
  }

  debug('Notification - formatMessage option: ', option);
  debug('Notification - formatMessage: ', outputMessage);
  return outputMessage;
};

const send = function(options, message, cb) {
  debug('send:', options, message);

  return async.parallel([
    function(next) {
        if (options['SLACK'] || (options['SLACK_WEBHOOK_URL'] != null)) {
          debug('Found Slack webhook, sending a notification');
          const slackMessage = {};
          slackMessage.text = formatMessage(message, 'markdown');
          slackMessage.channel = options['SLACK'] != null ? options['SLACK']['CHANNEL'] : undefined;
          const slackOptions = {};
          slackOptions.webhookUrl = (options['SLACK'] != null ? options['SLACK']['SLACK_WEBHOOK_URL'] : undefined) || options['SLACK_WEBHOOK_URL'];
          return createSlackMessage(slackOptions, slackMessage, next);
        } else {
          debug('No Slack webhook defined');
          return next();
        }
      },
    function(next) {
        if (!options['PAGERDUTY'] && !options['PAGERDUTY_TOKEN']) {
          return debug('No PAGERDUTY options defined');
        } else if ((options['PAGERDUTY']['PAGERDUTY_TOKEN'] || options['PAGERDUTY_TOKEN']) && options['PAGERDUTY']['PAGERDUTY_SERVICE_ID'] && options['PAGERDUTY']['PAGERDUTY_FROM']) {
          debug('Found PD token - creating an incident');
          const pdOptions = {};
          pdOptions.pdToken = options['PAGERDUTY']['PAGERDUTY_TOKEN'] || options['PAGERDUTY_TOKEN'];
          pdOptions.serviceId = options['PAGERDUTY']['PAGERDUTY_SERVICE_ID'];
          pdOptions.escalationPolicyId = options['PAGERDUTY']['PAGERDUTY_ESCALATION_POLICY_ID'];
          pdOptions.from = options['PAGERDUTY'] != null ? options['PAGERDUTY']['PAGERDUTY_FROM'] : undefined;
          const messagesByUser = formatMessage(message, 'json');
          return async.each(messagesByUser,
            (item, cb) => createPagerDutyIncident(pdOptions, item, cb),
            err => next(err));
        } else {
          console.log(`No PD options defined or defined incorrectly (${JSON.stringify(options['PAGERDUTY'])})`);
          return next();
        }
      }
    ], function(err, results) {
      if (err) { return cb(err); }
      const output = results.filter(n => n !== undefined);
      return cb(null, output);
  });
};

module.exports = {
  send
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}