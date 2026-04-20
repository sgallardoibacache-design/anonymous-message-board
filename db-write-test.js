require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.DB);

  try {
    await client.connect();
    console.log('Mongo connect OK');

    const db = client.db('messageboard');
    const collection = db.collection('threads');

    const doc = {
      board: 'testboard',
      text: 'test thread',
      delete_password: 'pass123',
      created_on: new Date(),
      bumped_on: new Date(),
      reported: false,
      replies: []
    };

    const insertResult = await collection.insertOne(doc);
    console.log('INSERT OK:', insertResult.insertedId.toString());

    const found = await collection.findOne({ _id: insertResult.insertedId });
    console.log('FIND OK:', !!found);

    await collection.deleteOne({ _id: insertResult.insertedId });
    console.log('DELETE OK');
  } catch (err) {
    console.error('WRITE TEST ERROR:');
    console.error(err);
  } finally {
    await client.close();
  }
}

run();