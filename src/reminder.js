const debug = require('debug')('pagerduty-overrides:reminder');
const nconf = require('nconf');
const _ = require('lodash');
const slackApi = require('./slack-api');
const pagerduty = require('./pagerduty');

function formatMessageFromTemplate(templateText, data) {
  const current = nconf.get(`slackUsers:${data.oncallEngineers.current.email}`) || data.oncallEngineers.current.name;
  const next = nconf.get(`slackUsers:${data.oncallEngineers.next.email}`) || data.oncallEngineers.next.name;
  const compiled = _.template(templateText);
  const outputMessage = compiled({ current, next, data });
  debug('Reminder - formatMessage: ', outputMessage);
  return outputMessage;
}

function sendFromTemplate(slackChannel, templateText, templateData, cb) {
  debug('sendFromTemplate:', slackChannel, templateText, templateData);

  slackApi.getUserList((err) => {
    if (err) { return cb(err); }
    const messageText = formatMessageFromTemplate(templateText, templateData);
    slackApi.sendSlackMessage(slackChannel, messageText, (sendError) => {
      if (sendError) { return cb(sendError); }
      return cb();
    });
  });
}

function sendMessage(data, type, cb) {
  if (!data.schedule || !data.escalationPolicy) {
    return cb(new Error('Missing schedule ID or escalation policy ID!'));
  }
  pagerduty.getEngineersOncallForHandover(data.schedule, data.escalationPolicy, (err, result) => {
    if (err) { return cb(err); }
    if (result == null) { return cb(new Error('No oncall engineers found!')); }
    const templateData = {
      oncallEngineers: result,
    };
    let templateText = data.templateText;
    if (type === 'reminder') {
      templateText = templateText || nconf.get('REMINDER_TEMPLATE') || "<@${current}>, Good morning, don't forget about your shift!";
    } else {
      templateText = templateText || nconf.get('HANDOVER_TEMPLATE') || "<@${current}> don't forget to handover your shift to <@${next}>\n";
    }

    sendFromTemplate(data.slackChannel || nconf.get('SLACK_CHANNEL'), templateText, templateData, (sendErr) => {
      if (sendErr) { return cb(new Error(sendErr.data.error)); }
      return cb();
    });
  });
}

module.exports = {
  sendMessage,
};
