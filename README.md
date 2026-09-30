# Shelv Web

A web player for [Navidrome](https://www.navidrome.org) and other Subsonic servers, built as the web counterpart to my iOS app [Shelv](https://github.com/gatzenga/Shelv).

This is a fork of [Aonsoku](https://github.com/victoralvesf/aonsoku) by Victor Alves, changed for my own use. It runs as a single Docker container that serves the app and proxies Navidrome, so the browser never talks to Navidrome directly.

## Run

Copy `docker-compose.yml`, adjust the environment values and the volume paths, then:

```
docker compose up -d
```

Every setting is an environment variable in that file.

## License

Copyright (c) 2026 gatzenga. Licensed under the [GNU General Public License v3.0](LICENSE).

This project contains code from [Aonsoku](https://github.com/victoralvesf/aonsoku), Copyright (c) 2026 Victor Alves, which is released under the MIT license. That license and its copyright notice are kept in [LICENSE-AONSOKU.txt](LICENSE-AONSOKU.txt).
