# Shelv Web

A web player for [Navidrome](https://www.navidrome.org) and other Subsonic servers, built as the web counterpart to my iOS app [Shelv](https://github.com/gatzenga/Shelv).

This is a fork of [Aonsoku](https://github.com/victoralvesf/aonsoku) by Victor Alves, changed for my own use. It runs as a single Docker container that serves the app and proxies Navidrome, so the browser never talks to Navidrome directly.

## Run

Copy `docker-compose.yml`, adjust the environment values and the volume paths, then:

```
docker compose up -d
```

Every setting is an environment variable in that file, see [docs/VARIABLES.md](docs/VARIABLES.md) for all of them and their values.

## Run it next to Navidrome

Shelv Web is meant to run on the same machine as Navidrome, in the same Docker network. `NAVIDROME_URL` is then the internal address of Navidrome and the two containers talk to each other directly.

Most web players for Subsonic servers are only static files. The browser loads them once and then sends every request itself straight to your Navidrome, so Navidrome has to be reachable from wherever the browser is: a public address or a VPN, and it has to allow requests from another origin (CORS). A player served over https also cannot talk to a Navidrome on plain http.

Shelv Web does it differently. The browser only talks to Shelv Web, and Shelv Web talks to Navidrome inside the Docker network. The browser never contacts Navidrome itself, so:

- Only Shelv Web needs to be reachable from outside, Navidrome itself does not have to be exposed for it.
- No CORS and no mixed content problems, the browser only ever sees one address.
- Streams, cover art and radio stations are passed through, and the Last.fm key stays on the server.

Running Shelv Web on another machine still works, `NAVIDROME_URL` can be any address that container can reach. Next to Navidrome is just what it is built for and what I recommend.

## Settings are variables

There is no settings screen. Every setting is a variable, set once in `docker-compose.yml`. This is on purpose: a setting made in the browser lives in that browser. Clear the cookies or the site data, open a new session or use another device, and everything is back to the defaults and has to be set again. A variable applies to every browser and every device, and it stays.

## Icons

Some icons are from [Phosphor Icons](https://phosphoricons.com) (MIT), see [LICENSE-PHOSPHOR.txt](LICENSE-PHOSPHOR.txt).

## License

Copyright (c) 2026 gatzenga. Licensed under the [GNU General Public License v3.0](LICENSE).

This project contains code from [Aonsoku](https://github.com/victoralvesf/aonsoku), Copyright (c) 2026 Victor Alves, which is released under the MIT license. That license and its copyright notice are kept in [LICENSE-AONSOKU.txt](LICENSE-AONSOKU.txt).
