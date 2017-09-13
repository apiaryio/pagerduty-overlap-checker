/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _         = require('underscore');
const debug     = require('debug')('pagerduty-overrides');
const request   = require('request');
const nconf     = require('nconf');
const url      = require('url');

// Factory for sending request to PD API
const send = function(endpointPath, overrideOptions, cb) {
  debug(`Calling ${endpointPath} with options:`, overrideOptions);
  const defaultOptions = {
    uri: url.resolve('https://api.pagerduty.com', endpointPath),
    method: 'GET',
    json: true
  };

  if (typeof overrideOptions === 'function') {
    cb = overrideOptions;
    overrideOptions = {};
  }

  _.extend(defaultOptions, overrideOptions);

  if (defaultOptions.headers == null) { defaultOptions.headers = []; }
  if (defaultOptions.headers.Authorization == null) { defaultOptions.headers.Authorization = `Token token=${nconf.get('PAGERDUTY_READ_ONLY_TOKEN')}`; }
  defaultOptions.headers.Accept =  'application/vnd.pagerduty+json;version=2';
  defaultOptions.headers['Content-Type'] = 'application/json';

  if (defaultOptions.qs == null) { defaultOptions.qs = []; }
  defaultOptions.qs.limit = 100;
  defaultOptions.qs.timezone = 'UTC';

  debug('Calling request with: ', defaultOptions);
  return request(defaultOptions, cb);
};

module.exports = {
  send
};
