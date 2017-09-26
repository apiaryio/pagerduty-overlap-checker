const _ = require('underscore');
const debug = require('debug')('pagerduty-overrides');
const request = require('request');
const nconf = require('nconf');
const url = require('url');

// Factory for sending request to PD API
function send(endpointPath, overrideOptions, cb) {
  let callback = cb;
  let options = overrideOptions;

  debug(`Calling ${endpointPath} with options:`, options);
  const defaultOptions = {
    uri: url.resolve('https://api.pagerduty.com', endpointPath),
    method: 'GET',
    json: true,
  };

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  _.extend(defaultOptions, options);

  if (!defaultOptions.headers) { defaultOptions.headers = []; }
  if (!defaultOptions.headers.Authorization) { defaultOptions.headers.Authorization = `Token token=${nconf.get('PAGERDUTY_READ_ONLY_TOKEN')}`; }
  defaultOptions.headers.Accept = 'application/vnd.pagerduty+json;version=2';
  defaultOptions.headers['Content-Type'] = 'application/json';

  if (!defaultOptions.qs) { defaultOptions.qs = []; }
  defaultOptions.qs.limit = 100;
  defaultOptions.qs.timezone = 'UTC';

  debug('Calling request with: ', defaultOptions);
  return request(defaultOptions, callback);
}

module.exports = {
  send,
};
