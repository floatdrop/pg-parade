'use strict';

const pgPromise = require('pg-promise');
const StackUtils = require('stack-utils');

const stack = new StackUtils({
	cwd: process.cwd(),
	internals: StackUtils.nodeInternals()
});

function indent(str) {
	return '    at ' + str;
}

const proxyMethods = [
	'query',
	'none',
	'one',
	'many',
	'any',
	'oneOrNone',
	'manyOrNone',
	'end'
];

module.exports = function (opts) {
	const PgParade = function PgParade(replicas) {
		if (!(this instanceof PgParade)) {
			return new PgParade(replicas);
		}

		if (replicas === undefined) {
			throw new Error('replicas argument is required');
		}

		if (typeof replicas !== 'function' && typeof replicas !== 'object') {
			throw new Error('replicas type must be function or object');
		}

		if (typeof replicas === 'function') {
			this._replicas = replicas;
		} else {
			this._replicas = () => Promise.resolve(replicas);
		}

		this.write = this._makeProxy('write');
		this.read = this._makeProxy('read');
		this.connections = new Map();
	};

	PgParade.prototype._getReplicas = function _getReplicas() {
		let repl = this._replicas();
		if (typeof repl.then !== 'function') {
			repl = Promise.resolve(repl);
		}

		return repl.then(replicas => {
			let read = replicas.read;
			if (typeof read === 'string' || typeof read === 'object') {
				if (this.connections.has(replicas.read)) {
					read = this.connections.get(replicas.read);
				} else {
					const pgp = pgPromise(Object.assign({}, opts, {noLocking: true}));
					read = pgp(read);
					read.end = () => pgp.end();
					this.connections.set(replicas.read, read);
				}
			}

			let write = replicas.write;
			if (typeof write === 'string' || typeof write === 'object') {
				if (this.connections.has(replicas.write)) {
					write = this.connections.get(replicas.write);
				} else {
					const pgp = pgPromise(Object.assign({}, opts, {noLocking: true}));
					write = pgp(write);
					write.end = () => pgp.end();
					this.connections.set(replicas.write, write);
				}
			}

			return {read, write};
		});
	};

	PgParade.prototype._makeProxy = function _makeProxy(type) {
		const self = this;

		function PgParade() {}
		const proxy = new PgParade();

		for (let method of proxyMethods) {
			proxy[method] = function () {
				const args = arguments;
				const stackTrace = stack.captureString(8, proxy[method]);
				return self._getReplicas().then(replicas => {
					const f = replicas[type][method];
					if (f === undefined) {
						if (method === 'end') {
							return undefined;
						}

						throw new Error(`Can not proxy method ${method} on ${type} replica`);
					}

					return f.apply(replicas[type], args);
				}).catch(err => {
					const title = err.stack.split('\n')[0];
					err.stack = title;
					if (typeof args[0] === 'string') {
						err.stack += '\nquery:\n  ' + args[0] + '\n';
					}
					err.stack += stackTrace.split('\n').filter(Boolean).map(indent).join('\n');
					throw err;
				});
			};
			Object.defineProperty(proxy[method], 'name', {value: method, configurable: true});
		}

		proxy.tx = function tx(cb) {
			if (type === 'read') {
				throw new Error('Can not run transaction on read replica');
			}

			return self._getReplicas().then(replicas => {
				return replicas.write.tx(t => {
					t.read = t;
					t.write = t;
					return cb(t);
				});
			});
		};

		return proxy;
	};

	PgParade.prototype.as = pgPromise.as;
	PgParade.prototype.utils = pgPromise.utils;

	return PgParade;
};
