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
	};

	PgParade.prototype._getReplicas = function _getReplicas() {
		let replicas = this._replicas();

		if (typeof replicas.then !== 'function') {
			replicas = Promise.resolve(replicas);
		}

		return replicas.then(replicas => {
			if (typeof replicas.read === 'string') {
				const pgp = pgPromise(Object.assign({}, opts, {noLocking: true}));
				replicas.read = pgp(replicas.read);
				replicas.read.end = () => pgp.end();
			}

			if (typeof replicas.write === 'string') {
				const pgp = pgPromise(Object.assign({}, opts, {noLocking: true}));
				replicas.write = pgp(replicas.write);
				replicas.write.end = () => pgp.end();
			}

			return replicas;
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

		proxy.tx = function (cb) {
			if (type === 'read') {
				throw new Error('Can not run transaction on read replica');
			}

			return self._getReplicas().then(replicas =>
				replicas.write.tx(t => {
					return cb({
						write: t,
						read: t
					});
				}));
		};

		return proxy;
	};

	PgParade.prototype.as = pgPromise.as;
	PgParade.prototype.utils = pgPromise.utils;

	return PgParade;
};
