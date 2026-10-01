# Shelv Web

A web player for [Navidrome](https://www.navidrome.org), built as the web counterpart to my iOS app [Shelv](https://github.com/gatzenga/Shelv).

This is a fork of [Aonsoku](https://github.com/victoralvesf/aonsoku) by Victor Alves, changed for my own use. It runs as a single Docker container that serves the app and proxies Navidrome, so the browser never talks to Navidrome directly.

## What it does

- **Discover** with smart mixes (Newest Tracks, Most Played, Recently Played, Shuffle All), recently added, recently played, frequently played and random albums. You choose which sections show and in which order.
- **Albums and Artists** with filter, sort and a grid or list view. Albums also have a genre filter, Play and Shuffle.
- **Artist pages** with top songs, the latest release, the discography, similar artists and the biography.
- **Album pages** with the tracks, Play, Shuffle, Instant Mix, Play Next, Add to Queue, share and favorite.
- **Favorites**, **Playlists** (a `/` in a name makes folders, like in the Shelv app) and **Search** with recent searches.
- **Radio** for stations in Navidrome: HLS, Icecast and Shoutcast, with now playing and cover from ICY or the AzuraCast API.
- **Synced lyrics** from Navidrome, your own LRCLIB server or lrclib.net.
- **Instant Mix** and **Infinity Mix**, a queue you can edit, and **Insights** with your most played artists, albums and songs.
- **Last.fm** for the top songs of an artist and for the mixes. It only reads from Last.fm.

## Run

You need a running [Navidrome](https://www.navidrome.org). Shelv Web is built for Navidrome, other Subsonic servers may work but are not tested.

Copy `docker-compose.yml`, set `NAVIDROME_URL` and `user:`, adjust the volume paths, then:

```
docker compose up -d
```

Open the address of the container and sign in with your Navidrome user. Every setting is an environment variable in that file, see [docs/VARIABLES.md](docs/VARIABLES.md) for all of them and their values.

To update: `docker compose pull && docker compose up -d`.

**Folders.** The container runs as the `user:` of the compose file and never changes permissions. Create the `cache`, `config` and `logs` folders for that user once, then mount them, like you would for Navidrome. `config` holds `lastfm.json` and `azuracast.json`.

**HTTPS.** The compose file publishes the port on `127.0.0.1` only. Put a reverse proxy with HTTPS in front of it to use Shelv Web from outside. The image is built for `linux/amd64` and `linux/arm64`, Docker picks the right one.

## Run it next to Navidrome

Shelv Web is meant to run on the same machine as Navidrome, in the same Docker network. `NAVIDROME_URL` is then the internal address of Navidrome and the two containers talk to each other directly.

Most web players for Subsonic servers are only static files. The browser loads them once and then sends every request itself straight to your Navidrome, so Navidrome has to be reachable from wherever the browser is: a public address or a VPN, and it has to allow requests from another origin (CORS). A player served over https also cannot talk to a Navidrome on plain http.

Shelv Web does it differently. The browser only talks to Shelv Web, and Shelv Web talks to Navidrome inside the Docker network. The browser never contacts Navidrome itself, so:

- Only Shelv Web needs to be reachable from outside, Navidrome itself does not have to be exposed for it.
- No CORS and no mixed content problems, the browser only ever sees one address.
- Streams, cover art and radio stations are passed through, and the Last.fm key stays on the server.

Running Shelv Web on another machine still works, `NAVIDROME_URL` can be any address that container can reach. Next to Navidrome is just what it is built for and what I recommend.

## Login

You sign in with your Navidrome user. The server checks it with Navidrome and gives the browser a cookie (HttpOnly, SameSite Strict, 30 days). After that the browser sends only the cookie, the login itself is not sent with every request and does not show up in addresses or logs. Too many wrong logins from one address are stopped for a while. Use HTTPS, so the cookie cannot be read on its way.

## Settings are variables

There is no settings screen. Every setting is a variable, set once in `docker-compose.yml`. This is on purpose: a setting made in the browser lives in that browser. Clear the cookies or the site data, open a new session or use another device, and everything is back to the defaults and has to be set again. A variable applies to every browser and every device, and it stays.

## Icons

Some icons are from [Phosphor Icons](https://phosphoricons.com) (MIT), see [LICENSE-PHOSPHOR.txt](LICENSE-PHOSPHOR.txt).

## License

Copyright (c) 2026 gatzenga. Licensed under the [GNU General Public License v3.0](LICENSE).

This project contains code from [Aonsoku](https://github.com/victoralvesf/aonsoku), Copyright (c) 2026 Victor Alves, which is released under the MIT license. That license and its copyright notice are kept in [LICENSE-AONSOKU.txt](LICENSE-AONSOKU.txt).
