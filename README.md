[![Build Status](https://travis-ci.org/apiaryio/pagerduty-overlap-checker.svg?branch=master)](https://travis-ci.org/apiaryio/pagerduty-overlap-checker)

# Pager Duty Overrides Checker

## Usage

1. Create config file `config.json`

- `PAGERDUTY_READ_ONLY_TOKEN` is used for read schedules and check them.
- `SCHEDULES` array can contains one or more `SCHEDULE` to check
- every `SCHEDULE` have `PAGERDUTY_TOKEN` to create incident if overlap is found

```json
{
	"PAGERDUTY_API_URL": "https://acme.pagerduty.com/api/v1",
	"PAGERDUTY_READ_ONLY_TOKEN": "33333333333333333333",
	"SCHEDULES": [{
		"SCHEDULE": ["PWEVPB6", "PT57OLG"],
		"NOTIFICATIONS": {
			"PAGERDUTY_TOKEN": "11111111111111111111"
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
