const debug = require('debug')('pagerduty-overrides:pagerduty-api');
const { WebClient } = require('@slack/client');
const nconf = require('nconf');

function getClient() {
  const token = nconf.get('SLACK_TOKEN');
  if (!token) {
    throw new Error('SLACK token missing in config');
  }
  return new WebClient(token);
}

function sendSlackMessage(channelId, messageText, done) {
  const web = getClient();
  web.chat.postMessage({ channel: channelId, text: messageText })
    .then((res) => {
      if (res.ok === false) { return done(new Error(`Slack returned an error: ${res.error}`)); }
      debug('Message sent: ', res.ts);
      return done();
    }).catch((err) => {
      done(err);
    });
}

function getUserList(done) {
  const web = getClient();
  web.users.list().then((res) => {
    if (res.ok === false) { return done(new Error(`Slack returned an error: ${res.error}`)); }
    const userList = res.members.filter(user => !user.is_bot && !user.deleted).map((user) => {
      nconf.set(`slackUsers:${user.profile.email}`, user.id);
      return {
        name: user.name,
        email: user.profile.email,
      };
    });
    return done(null, userList);
  });
}

module.exports = {
  sendSlackMessage,
  getUserList,
};
