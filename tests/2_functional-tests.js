'use strict';

const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function () {
  const board = 'board' + Date.now();
  const threadText = 'test thread ' + Date.now();
  const threadPassword = 'threadpass';
  const replyText = 'test reply ' + Date.now();
  const replyPassword = 'replypass';

  let threadId;
  let replyId;

  test('Creating a new thread: POST request to /api/threads/{board}', function (done) {
    chai
      .request(server)
      .post('/api/threads/' + board)
      .type('form')
      .send({
        text: threadText,
        delete_password: threadPassword
      })
      .redirects(0)
      .end(function (err, res) {
        assert.oneOf(res.status, [200, 302]);
        done();
      });
  });

  test('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', function (done) {
    chai
      .request(server)
      .get('/api/threads/' + board)
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        assert.isAtMost(res.body.length, 10);

        const thread = res.body.find((item) => item.text === threadText) || res.body[0];

        assert.exists(thread);
        assert.property(thread, '_id');
        assert.notProperty(thread, 'delete_password');
        assert.notProperty(thread, 'reported');
        assert.isArray(thread.replies);
        assert.isAtMost(thread.replies.length, 3);

        threadId = thread._id;
        done();
      });
  });

  test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/threads/' + board)
      .send({
        thread_id: threadId,
        delete_password: 'wrongpass'
      })
      .end(function (err, res) {
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  test('Reporting a thread: PUT request to /api/threads/{board}', function (done) {
    chai
      .request(server)
      .put('/api/threads/' + board)
      .send({
        thread_id: threadId
      })
      .end(function (err, res) {
        assert.equal(res.text, 'reported');
        done();
      });
  });

  test('Creating a new reply: POST request to /api/replies/{board}', function (done) {
    chai
      .request(server)
      .post('/api/replies/' + board)
      .type('form')
      .send({
        thread_id: threadId,
        text: replyText,
        delete_password: replyPassword
      })
      .redirects(0)
      .end(function (err, res) {
        assert.oneOf(res.status, [200, 302]);
        done();
      });
  });

  test('Viewing a single thread with all replies: GET request to /api/replies/{board}', function (done) {
    chai
      .request(server)
      .get('/api/replies/' + board)
      .query({ thread_id: threadId })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.equal(res.body._id, threadId);
        assert.notProperty(res.body, 'delete_password');
        assert.notProperty(res.body, 'reported');
        assert.isArray(res.body.replies);

        const reply = res.body.replies.find((item) => item.text === replyText) || res.body.replies[0];

        assert.exists(reply);
        assert.notProperty(reply, 'delete_password');
        assert.notProperty(reply, 'reported');

        replyId = reply._id;
        done();
      });
  });

  test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/replies/' + board)
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: 'wrongpass'
      })
      .end(function (err, res) {
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  test('Reporting a reply: PUT request to /api/replies/{board}', function (done) {
    chai
      .request(server)
      .put('/api/replies/' + board)
      .send({
        thread_id: threadId,
        reply_id: replyId
      })
      .end(function (err, res) {
        assert.equal(res.text, 'reported');
        done();
      });
  });

  test('Deleting a reply with the correct password: DELETE request to /api/replies/{board} with a valid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/replies/' + board)
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: replyPassword
      })
      .end(function (err, res) {
        assert.equal(res.text, 'success');

        chai
          .request(server)
          .get('/api/replies/' + board)
          .query({ thread_id: threadId })
          .end(function (err2, res2) {
            const deletedReply = res2.body.replies.find((item) => item._id === replyId);
            assert.exists(deletedReply);
            assert.equal(deletedReply.text, '[deleted]');
            done();
          });
      });
  });

  test('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', function (done) {
    chai
      .request(server)
      .delete('/api/threads/' + board)
      .send({
        thread_id: threadId,
        delete_password: threadPassword
      })
      .end(function (err, res) {
        assert.equal(res.text, 'success');
        done();
      });
  });
});