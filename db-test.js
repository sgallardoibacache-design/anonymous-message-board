require('dotenv').config();
const { MongoClient } = require('mongodb');

async function test() {
  try {
    console.log('DB value exists:', !!process.env.DB);
    const client = new MongoClient(process.env.DB);
    await client.connect();
    console.log('Mongo OK');
    await client.close();
  } catch (err) {
    console.error('MONGO ERROR:');
    console.error(err);
  }
}

test();