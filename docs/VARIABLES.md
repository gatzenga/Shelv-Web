# Variables

Everything is set in the `environment:` section of `docker-compose.yml`. The
values are read when the container starts, change one and run
`docker compose up -d` again. Every variable except `NAVIDROME_URL` is
optional, the default is what applies when it is left out.

Yes/no values are `true` or `false`. Anything else stops the container with an
error that names the variable.

## Connection

| Variable | Default | Meaning |
| --- | --- | --- |
| `NAVIDROME_URL` | required | Where Navidrome is reached from this container, e.g. `http://navidrome:4533` or `http://172.20.0.10:4533`. Use the address inside the Docker network, see [Run it next to Navidrome](../README.md#run-it-next-to-navidrome). |
| `SHARE_BASE_URL` | empty | The address share links start with, e.g. `https://music.example.com`. Navidrome builds a link from the address it is reached on, and that is the internal one of the Docker network. Set the address that people outside can open. |
| `PORT` | `8080` | Port inside the container. |

## Appearance and sections

| Variable | Default | Meaning |
| --- | --- | --- |
| `LANGUAGE` | `de` | `de` or `en`. |
| `SIDEBAR_ALBUMS` | `true` | Show Albums in the sidebar. |
| `SIDEBAR_ARTISTS` | `true` | Show Artists in the sidebar. |
| `SIDEBAR_GENRES` | `true` | Show Genres in the sidebar. Also hides the genre filter on the Albums page. |
| `SIDEBAR_RADIOS` | `true` | Show Radios in the sidebar. |
| `FEATURE_FAVORITES` | `true` | Show Favorites in the sidebar and the favorite buttons. |
| `FEATURE_PLAYLISTS` | `true` | Show the playlists in the sidebar and the add to playlist buttons. |
| `DISCOVER_SECTIONS` | all five | The sections of the Discover page and their order, separated by commas: `smart-mixes`, `recently-added`, `recently-played`, `frequently-played`, `random-albums`. A section that is not listed is not shown. |

## Mixes

| Variable | Default | Meaning |
| --- | --- | --- |
| `SONGS_TO_ADD` | `5` | How many songs Infinity Mix adds each time, 1 to 10. |
| `MATCH_CURRENT_SONG` | `true` | Infinity Mix picks songs that fit the one playing. |

## Playing

| Variable | Default | Meaning |
| --- | --- | --- |
| `SCROBBLE_COUNT` | `30` | How much of a song has to be played, in percent, before Navidrome counts it as played. Usual values are 10, 20, 30, 40 and 50. |

## Last.fm

Needs an API account from [last.fm/api](https://www.last.fm/api/account/create).
Shelv Web only reads from Last.fm and never scrobbles. The connection to your
account is made in the app and kept in `config/lastfm.json`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `LASTFM_API` | empty | The API key. `LASTFM_API_KEY` works as well. |
| `LASTFM_SECRET` | empty | The shared secret. |
| `LASTFM_TOP_SONGS` | `true` | The Top Songs of an artist come from Last.fm. Off: the songs you played most on your server. |
| `LASTFM_PERIOD` | `3month` | The time span of the Frequently Played mix: `7day`, `1month`, `3month`, `6month`, `12month` or `overall`. A shorter span keeps the mix fresher. |
| `LASTFM_MIXES` | `true` | Frequently Played and Recently Played come from your Last.fm history. Off: from the play counts of your server. |

## Lyrics

Each source is turned on by its own variable. The order is always the same:
the cache, Navidrome, your own server, the public LRCLIB. Only the turned on
sources are asked. With none turned on, the public LRCLIB (lrclib.net) is used.

| Variable | Default | Meaning |
| --- | --- | --- |
| `LYRICS_NAVIDROME` | `false` | Use the lyrics stored in Navidrome. |
| `LYRICS_CUSTOM_SERVER` | empty | The address of your own [LRCLIB](https://github.com/tranxuanthang/lrclib) server. Setting it turns it on. `LYRICS_SERVER` still works as the old name. |
| `LYRICS_LRCLIB` | `false` | Use the public LRCLIB (lrclib.net). |

## Cache and folders

| Variable | Default | Meaning |
| --- | --- | --- |
| `CACHE_IMAGES` | `false` | Keep cover images on disk. |
| `CACHE_LYRICS` | `false` | Keep lyrics on disk. |
| `CACHE_DIR` | `/cache` | Folder of the cache. |
| `CONFIG_DIR` | `/config` | Folder of the files below. |
| `LOGS_DIR` | `/logs` | Folder of the logs. |

The three folders are mounted from the host in `volumes:`. The container runs
as the `user:` from the compose file and creates its files with the rights of
the mounted folder, it never changes permissions itself.

## Files in the config folder

These are not variables. The app writes them, you can move or edit them.

| File | Content |
| --- | --- |
| `lastfm.json` | The Last.fm session. |
| `azuracast.json` | Per radio station: use the AzuraCast API, its URL, show the song cover. Set in the dialog of a station. |
