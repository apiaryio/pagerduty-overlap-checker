[![Build Status](https://travis-ci.org/apiaryio/pagerduty-overlap-checker.svg?branch=master)](https://travis-ci.org/apiaryio/pagerduty-overlap-checker)
[![Coverage Status](https://coveralls.io/repos/github/apiaryio/pagerduty-overlap-checker/badge.svg?branch=master)](https://coveralls.io/github/apiaryio/pagerduty-overlap-checker?branch=master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

# NodeJS supported versions

- 6.x (LTS)

# Pager Duty Overrides Checker

## Usage

1. Create config file `config.json`

- `PAGERDUTY_READ_ONLY_TOKEN` is used for reading schedules and checking the overlaps.
- `SCHEDULES` array can contain one or more `SCHEDULE` items to check
- every `SCHEDULE` should have a `NOTIFICATIONS` section to create a PagerDuty incident or send a Slack message if overlap is found
- `SCHEDULE` can contain a `EXCLUSION_DAYS` key, which specifies days (3 letter abb.) in form of object with optional `start` and `end` time (`hh:mm` format **CET TIMEZONE**).If `start` or `end` is omitted, whole day is considered excluded.
Example below represents current weekend on-call setup.

Currently, we support Slack (`SLACK` with `SLACK_WEBHOOK_URL` and `CHANNEL`) or shorthanded `SLACK_WEBHOOK_URL` and 
PagerDuty (`PAGERDUTY` with `PAGERDUTY_TOKEN`, `PAGERDUTY_SERVICE_ID` and `PAGERDUTY_FROM`) notifications. The 
`PAGERDUTY_TOKEN` has to have full access.

For PagerDuty, an incident can either be directly assigned to the user with overlaps (default) or set to an escalation 
policy (if specified by `PAGERDUTY_ESCALATION_POLICY_ID` in config).

All PagerDuty integrations are using [PagerDuty API v2](https://v2.developer.pagerduty.com/v2/page/api-reference#!/API_Reference/get_api_reference).
When generating an API token, select the v2 option.

```json
{
    "PAGERDUTY_API_URL": "https://acme.pagerduty.com/api/v1",
    "PAGERDUTY_READ_ONLY_TOKEN": "33333333333333333333",
    "WEEKS_TO_CHECK": 2,
    "SCHEDULES": [{
        "SCHEDULE": ["PWEVPB6", "PT57OLG"],
        "NOTIFICATIONS": {
            "SLACK": {
              "SLACK_WEBHOOK_URL": "http://acme.slack.com/11111",
              "CHANNEL": "#channel-name"
            }
        }
    }, {
        "SCHEDULE": ["PWEVPB6", "PT57OLA"],
        "NOTIFICATIONS": {
          "PAGERDUTY": {
            "PAGERDUTY_TOKEN": "22222222222222222222",
            "PAGERDUTY_SERVICE_ID": "PFARE53",
            "PAGERDUTY_FROM": "test@test.com"
          },
          "SLACK_WEBHOOK_URL": "http://acme.slack.com/11111"
        },
        "EXCLUSION_DAYS": {"Fri": {"start": "18:00", "end": "23:59"}, "Sat": {}, "Sun": {"start": "00:00", "end": "18:00"}}
    }]
}
```

2. Run command and check:

```sh
$ ./bin/pdoverrides check --config config.json

Config schedule IDs passed.
OK
```

## Debug problems

For debugging you can use `debug` package included in the library:

`DEBUG=pagerduty-overrides* ./bin/pdoverrides check -c config.json`

Alternatively, you can include the `DEBUG` variable in the `config.json` file (esp. for debugging on AWS Lambda).
