'use strict';

const pgPromise = require('pg-promise');

module.exports = function (opts) {
	const pgp = pgPromise(opts);

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
				replicas.read = pgp(replicas.read);
			}

			if (typeof replicas.write === 'string') {
				replicas.write = pgp(replicas.write);
			}

			return replicas;
		});
	};

	PgParade.prototype._makeProxy = function _makeProxy(type) {
		const self = this;

		const proxy = {};

		[
			'query',
			'none',
			'one',
			'many',
			'any',
			'oneOrNone',
			'manyOrNone',
			'func',
			'proc',
			'task',
			'tx',
			'end'
		].forEach(method => {
			proxy[method] = function () {
				const args = arguments;
				return self._getReplicas().then(replicas =>
					replicas[type][method].apply(replicas[type], args));
			};
		});

		return proxy;
	};

	return PgParade;
};
