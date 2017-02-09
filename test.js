import test from 'ava';
import pgParade from './';

const pgp = pgParade();
const connectionString = 'postgres://localhost:5432/postgres';

test('strings in replicas', async t => {
	const db = pgp({
		write: connectionString,
		read: connectionString
	});

	const read = await db.read.query('SELECT pg_is_in_recovery()');
	t.is(read.length, 1);

	const write = await db.write.query('SELECT pg_is_in_recovery()');
	t.is(write.length, 1);
});

test('function with object in replicas', async t => {
	const db = pgp(() => ({
		write: connectionString,
		read: connectionString
	}));

	const read = await db.read.query('SELECT pg_is_in_recovery()');
	t.is(read.length, 1);

	const write = await db.write.query('SELECT pg_is_in_recovery()');
	t.is(write.length, 1);
});

test('function with promise in replicas', async t => {
	const db = pgp(() => Promise.resolve({
		write: connectionString,
		read: connectionString
	}));

	const read = await db.read.query('SELECT pg_is_in_recovery()');
	t.is(read.length, 1);

	const write = await db.write.query('SELECT pg_is_in_recovery()');
	t.is(write.length, 1);
});

test('transactions', async t => {
	const db = pgp(() => Promise.resolve({
		write: connectionString,
		read: connectionString
	}));

	const result = await db.write.tx(async t1 => {
		return t1.write.query('SELECT pg_is_in_recovery()');
	});

	t.is(result.length, 1);
});

test('nested transactions', async t => {
	const db = pgp(() => Promise.resolve({
		write: connectionString,
		read: connectionString
	}));

	const result = await db.write.tx(async (t1) => {
		return t1.write.tx(async (t2) => {
			return t2.write.query('SELECT pg_is_in_recovery()');
		});
	});

	t.is(result.length, 1);
});
