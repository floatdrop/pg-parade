<h1 align="center">
	<br>
	<img width="400" src="https://rawgit.com/floatdrop/pg-parade/master/media/logotype.png" alt="pg-parade">
	<br>
	<br>
	<br>
</h1>

> Manage connections to Postgres replications

[![Build Status](https://travis-ci.org/floatdrop/pg-parade.svg?branch=master)](https://travis-ci.org/floatdrop/pg-parade)

This module extends [pg-promise](https://github.com/vitaly-t/pg-promise) for replications support.

## Install

```
$ npm install --save pg-parade
```


## Usage

```js
const pgp = require('pg-parade')();
const db = pgp({
	write: 'postgres://localhost:5432/postgres',
	read: 'postgres://localhost:5433/postgres'
});

db.write.query('INSERT INTO test VALUES (1)'); // Will be executed on write server
db.read.query('SELECT * FROM test'); // Will be executed on read server
```


## API

### pgParade([options])

#### options

[Initialization options](https://github.com/vitaly-t/pg-promise#advanced) from `pg-promise`.

Returns instance of initialized database factory.

### factory(cluster)

Returns Database object with two operations scopes:

- `read` - query will be executed on closest read server
- `write` - query will be executed on closest write server

#### cluster
Type: `Object`, `Function`

Object with `read` and `write` connection strings.

If `cluster` is type of Function – then it should return a promise, resolving to an Object.

## License

MIT © [Vsevolod Strukchinsky](http://github.com/floatdrop)
