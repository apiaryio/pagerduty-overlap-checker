[![Build Status](https://travis-ci.org/apiaryio/pagerduty-overlap-checker.svg?branch=master)](https://travis-ci.org/apiaryio/pagerduty-overlap-checker)
[![Coverage Status](https://coveralls.io/repos/github/apiaryio/pagerduty-overlap-checker/badge.svg?branch=master)](https://coveralls.io/github/apiaryio/pagerduty-overlap-checker?branch=master)

# NodeJS supported versions

- 4.3 (LTS)
- 5.x latest

# Pager Duty Overrides Checker

## Usage

1. Create config file `config.json`

- `PAGERDUTY_READ_ONLY_TOKEN` is used for reading schedules and checking the overlaps.
- `SCHEDULES` array can contain one or more `SCHEDULE` items to check
- every `SCHEDULE` should have a `NOTIFICATIONS` to create incident or send message if overlap is found
- `SCHEDULE` can contain a `EXCLUSION_DAYS` key, which specifies days (3 letter abb.) in form of object with optional `start` and `end` time (`hh:mm` format). If `start` or `end` is omitted, whole day is considered excluded. 
Example below represents current weekend on-call setup. All datetimes are translated to UTC, so feel free to use a local time.

Currently, we only support Slack (`SLACK` with `SLACK_WEBHOOK_URL` and `CHANNEL`) and PagerDuty (`PAGERDUTY_TOKEN`) notifications.

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
			"PAGERDUTY_TOKEN": "22222222222222222222"
		},
		"EXCLUSION_DAYS": {"Fri": {"start": "16:00", "end": "23:59"}, "Sat": {}, "Sun": {"start": "00:00", "end": "16:00"}}
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