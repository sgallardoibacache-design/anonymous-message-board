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