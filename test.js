import test from 'ava';
import pgParade from './';

const pgp = pgParade();

test('strings in replicas', async t => {
	const db = pgp({
		write: 'postgres://localhost:5432/postgres',
		read: 'postgres://localhost:5432/postgres'
	});

	const read = await db.read.query('SELECT pg_is_in_recovery()');
	t.is(read.length, 1);

	const write = await db.write.query('SELECT pg_is_in_recovery()');
	t.is(write.length, 1);
});

test('function with object in replicas', async t => {
	const db = pgp(() => ({
		write: 'postgres://localhost:5432/postgres',
		read: 'postgres://localhost:5432/postgres'
	}));

	const read = await db.read.query('SELECT pg_is_in_recovery()');
	t.is(read.length, 1);

	const write = await db.write.query('SELECT pg_is_in_recovery()');
	t.is(write.length, 1);
});

test('function with promise in replicas', async t => {
	const db = pgp(() => Promise.resolve({
		write: 'postgres://localhost:5432/postgres',
		read: 'postgres://localhost:5432/postgres'
	}));

	const read = await db.read.query('SELECT pg_is_in_recovery()');
	t.is(read.length, 1);

	const write = await db.write.query('SELECT pg_is_in_recovery()');
	t.is(write.length, 1);
});
