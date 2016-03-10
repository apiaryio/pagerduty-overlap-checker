[![Build Status](https://travis-ci.org/apiaryio/pagerduty-overlap-checker.svg?branch=master)](https://travis-ci.org/apiaryio/pagerduty-overlap-checker)

# NodeJS supported versions

- 4.3 (LTS)
- 5.x latest

# Pager Duty Overrides Checker

## Usage

1. Create config file `config.json`

- `PAGERDUTY_READ_ONLY_TOKEN` is used for reading schedules and checking the overlaps.
- `SCHEDULES` array can contain one or more `SCHEDULE` items to check
- every `SCHEDULE` should have a `NOTIFICATIONS` to create incident or send message if overlap is found

Currently, we only support Slack (`SLACK_WEBHOOK_URL`) and PagerDuty (`PAGERDUTY_TOKEN`) notifications.

```json
{
	"PAGERDUTY_API_URL": "https://acme.pagerduty.com/api/v1",
	"PAGERDUTY_READ_ONLY_TOKEN": "33333333333333333333",
	"WEEKS_TO_CHECK": 2,
	"SCHEDULES": [{
		"SCHEDULE": ["PWEVPB6", "PT57OLG"],
		"NOTIFICATIONS": {
			"SLACK_WEBHOOK_URL": "http://acme.slack.com/11111"
		}
	}, {
		"SCHEDULE": ["PWEVPB6", "PT57OLA"],
		"NOTIFICATIONS": {
			"PAGERDUTY_TOKEN": "22222222222222222222"
		}
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
