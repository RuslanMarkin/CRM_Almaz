# DNS snapshot: voyageone.ru

Captured: 2026-08-07 15:24:53 MSK

Source: ISPmanager DNS API. This snapshot contains no login credentials.

## Zone records

| Name | TTL | Type | Value | Notes |
| --- | ---: | --- | --- | --- |
| `voyageone.ru.` | 3600 | A | `37.140.192.64` | |
| `www.voyageone.ru.` | 3600 | A | `37.140.192.64` | |
| `ftp.voyageone.ru.` | 3600 | A | `37.140.192.64` | |
| `mail.voyageone.ru.` | 3600 | A | `37.140.192.64` | |
| `smtp.voyageone.ru.` | 3600 | A | `37.140.192.64` | |
| `pop.voyageone.ru.` | 3600 | A | `37.140.192.64` | |
| `billing-ping.voyageone.ru.` | 3600 | A | `127.0.0.1` | |
| `voyageone.ru.` | 3600 | AAAA | `2a00:f940:2:2:1:1:0:110` | |
| `www.voyageone.ru.` | 3600 | AAAA | `2a00:f940:2:2:1:1:0:110` | |
| `ftp.voyageone.ru.` | 3600 | AAAA | `2a00:f940:2:2:1:1:0:110` | |
| `mail.voyageone.ru.` | 3600 | AAAA | `2a00:f940:2:2:1:1:0:110` | |
| `smtp.voyageone.ru.` | 3600 | AAAA | `2a00:f940:2:2:1:1:0:110` | |
| `pop.voyageone.ru.` | 3600 | AAAA | `2a00:f940:2:2:1:1:0:110` | |
| `crm.voyageone.ru.` | 3600 | CNAME | `m87mrgwy.up.railway.app.` | Railway CRM custom domain |
| `voyageone.ru.` | 3600 | MX | `mx1.hosting.reg.ru.` | priority 10 |
| `voyageone.ru.` | 3600 | MX | `mx2.hosting.reg.ru.` | priority 20 |
| `voyageone.ru.` | 3600 | NS | `ns1.hosting.reg.ru.` | |
| `voyageone.ru.` | 3600 | NS | `ns2.hosting.reg.ru.` | |
| `voyageone.ru.` | 3600 | SOA | `support.reg.ru.` | mname `server110.hosting.reg.ru.`, serial `2026080703` |
| `voyageone.ru.` | 3600 | TXT | `v=spf1 ip4:37.140.192.64 a mx include:_spf.hosting.reg.ru ~all` | SPF |
| `_railway-verify.crm.voyageone.ru.` | 3600 | TXT | `railway-verify=e0c7fba05bec23ff604f8f74fbc06e3867ae13a2e95fd1ba0dd0973aab795ed3` | Railway verification |

## Current hosting configuration

- Authoritative nameservers: `ns1.hosting.reg.ru`, `ns2.hosting.reg.ru`
- CRM service: `crm.voyageone.ru` -> Railway, target port `8080`
- Existing web/mail host: `37.140.192.64` and `2a00:f940:2:2:1:1:0:110`

## Rollback note

If the domain is moved to another DNS provider, recreate every record from this table before changing the authoritative nameservers. Preserve the MX, SPF and `mail` / `smtp` / `pop` records to avoid email disruption.
