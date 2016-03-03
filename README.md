# Pager Duty Overrides Checker

## Usage

1. Create config file `~/.pagerduty`

```json
{
  "PAGERDUTY_API_URL": "https://acme.pagerduty.com/api/v1",
  "PAGERDUTY_READ_ONLY_TOKEN": "E7px6VVr3PVHZPJq51oa",
  "PAGERDUTY_TOKEN": "E7px6VVr3PVHZPJq51oa",
  "SLACK_HOOK_URL": "https://acme.slack.com/xxx",
  "SCHEDULES":
    [
        ["PWEVPB6", "PT57OLG"]
      ,
        ["PWEVPB6", "PT57OLA"]
    ],
  "NOTIFICATIONS": {
    "SLACK": "1",
    "PAGERDUTY_INCIDENT": "1"
  }
}
```
