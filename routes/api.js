'use strict';

const { MongoClient, ObjectId } = require('mongodb');

const client = new MongoClient(process.env.DB);
let collectionPromise;

async function getCollection() {
  if (!collectionPromise) {
    collectionPromise = client.connect().then(() => {
      return client.db('messageboard').collection('threads');
    });
  }
  return collectionPromise;
}

function sortRepliesNewestFirst(replies = []) {
  return [...replies].sort((a, b) => {
    const dateDiff = new Date(b.created_on) - new Date(a.created_on);
    if (dateDiff !== 0) return dateDiff;
    return b._id.toString().localeCompare(a._id.toString());
  });
}

function sanitizeReply(reply) {
  return {
    _id: reply._id,
    text: reply.text,
    created_on: reply.created_on
  };
}

function sanitizeThread(thread, limitReplies = false) {
  const orderedReplies = sortRepliesNewestFirst(thread.replies || []);
  const replies = limitReplies ? orderedReplies.slice(0, 3) : orderedReplies;

  return {
    _id: thread._id,
    text: thread.text,
    created_on: thread.created_on,
    bumped_on: thread.bumped_on,
    replies: replies.map(sanitizeReply),
    replycount: (thread.replies || []).length
  };
}

module.exports = function (app) {
  app
    .route('/api/threads/:board')

    .post(async function (req, res) {
      try {
        const collection = await getCollection();
        const board = req.params.board;
        const { text, delete_password } = req.body;
        const now = new Date();

        await collection.insertOne({
          board,
          text,
          delete_password,
          created_on: now,
          bumped_on: now,
          reported: false,
          replies: []
        });

        return res.redirect(`/b/${board}/`);
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    .get(async function (req, res) {
      try {
        const collection = await getCollection();
        const board = req.params.board;

        const threads = await collection
          .find({ board })
          .sort({ bumped_on: -1, _id: -1 })
          .limit(10)
          .toArray();

        return res.json(threads.map((thread) => sanitizeThread(thread, true)));
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
      }
    })

    .put(async function (req, res) {
      try {
        const collection = await getCollection();
        const { thread_id } = req.body;

        if (!ObjectId.isValid(thread_id)) {
          return res.send('reported');
        }

        await collection.updateOne(
          { _id: new ObjectId(thread_id), board: req.params.board },
          { $set: { reported: true } }
        );

        return res.send('reported');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    .delete(async function (req, res) {
      try {
        const collection = await getCollection();
        const { thread_id, delete_password } = req.body;

        if (!ObjectId.isValid(thread_id)) {
          return res.send('incorrect password');
        }

        const result = await collection.deleteOne({
          _id: new ObjectId(thread_id),
          board: req.params.board,
          delete_password
        });

        return res.send(result.deletedCount ? 'success' : 'incorrect password');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    });

  app
    .route('/api/replies/:board')

    .post(async function (req, res) {
      try {
        const collection = await getCollection();
        const { thread_id, text, delete_password } = req.body;

        if (!ObjectId.isValid(thread_id)) {
          return res.status(400).send('invalid thread id');
        }

        const now = new Date();
        const reply = {
          _id: new ObjectId(),
          text,
          delete_password,
          created_on: now,
          reported: false
        };

        const result = await collection.updateOne(
          { _id: new ObjectId(thread_id), board: req.params.board },
          {
            $push: {
              replies: {
                $each: [reply],
                $position: 0
              }
            },
            $set: { bumped_on: now }
          }
        );

        if (!result.matchedCount) {
          return res.status(404).send('thread not found');
        }

        return res.redirect(`/b/${req.params.board}/${thread_id}`);
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    .get(async function (req, res) {
      try {
        const collection = await getCollection();
        const { thread_id } = req.query;

        if (!ObjectId.isValid(thread_id)) {
          return res.status(400).json({ error: 'invalid thread id' });
        }

        const thread = await collection.findOne({
          _id: new ObjectId(thread_id),
          board: req.params.board
        });

        if (!thread) {
          return res.status(404).json({ error: 'thread not found' });
        }

        return res.json(sanitizeThread(thread, false));
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
      }
    })

    .put(async function (req, res) {
      try {
        const collection = await getCollection();
        const { thread_id, reply_id } = req.body;

        if (!ObjectId.isValid(thread_id) || !ObjectId.isValid(reply_id)) {
          return res.send('reported');
        }

        await collection.updateOne(
          {
            _id: new ObjectId(thread_id),
            board: req.params.board,
            'replies._id': new ObjectId(reply_id)
          },
          {
            $set: { 'replies.$.reported': true }
          }
        );

        return res.send('reported');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    })

    .delete(async function (req, res) {
      try {
        const collection = await getCollection();
        const { thread_id, reply_id, delete_password } = req.body;

        if (!ObjectId.isValid(thread_id) || !ObjectId.isValid(reply_id)) {
          return res.send('incorrect password');
        }

        const thread = await collection.findOne({
          _id: new ObjectId(thread_id),
          board: req.params.board
        });

        if (!thread) {
          return res.send('incorrect password');
        }

        const reply = thread.replies.find(
          (item) => item._id.toString() === reply_id
        );

        if (!reply || reply.delete_password !== delete_password) {
          return res.send('incorrect password');
        }

        await collection.updateOne(
          {
            _id: new ObjectId(thread_id),
            board: req.params.board,
            'replies._id': new ObjectId(reply_id)
          },
          {
            $set: { 'replies.$.text': '[deleted]' }
          }
        );

        return res.send('success');
      } catch (err) {
        console.error(err);
        return res.status(500).send('server error');
      }
    });
};