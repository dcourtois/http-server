Introduction
------------

This is a small http server based on [NodeJS](https://nodejs.org/en/) that I use for testing WebGL applications. It handles file compression, logging, and an optional delay (used to check how applications behave on slow servers, check asynchronous behaviors, etc.)

Use
---

1. Clone this repository
2. Run the server using `node server`

Options
-------

For a complete list of options, run `node server -help`


#####-log

Enables logging.

#####-compress

Enables file compression.

#####-port <number>

Use a custom port to listen to requests. By default, it's using `8000`.

#####-lag <number>

Set a small delay in milliseconds before answering requests.
