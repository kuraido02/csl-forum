import "./Home.css";
import { useState } from "react";

const posts = [
  { id: 1, community: "webdev", author: "maria", title: "How do you structure a React project as it grows?", likes: 128 },
  { id: 2, community: "javascript", author: "juan", title: "Closures finally clicked for me today", likes: 76 },
  { id: 3, community: "css", author: "ana", title: "Flexbox vs Grid: when do you pick which?", likes: 54 },
];

// A small form used for both new comments and replies
function CommentForm({ placeholder, onSubmit }) {
  const [text, setText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  );
}

function Comment({ comment, onDelete }) {
  const [liked, setLiked] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replies, setReplies] = useState([]);

  const addReply = (text) => {
    setReplies([...replies, { id: Date.now(), text }]);
    setReplying(false);
  };

  const deleteReply = (id) => setReplies(replies.filter((r) => r.id !== id));

  return (
    <div className="comment">
      <p>{comment.text}</p>

      <div className="comment-actions">
        <button className={liked ? "liked" : ""} onClick={() => setLiked(!liked)}>
          {liked ? "❤️" : "🤍"} {liked ? 1 : 0}
        </button>
        <button onClick={() => setReplying(!replying)}>Reply</button>
        <button onClick={() => onDelete(comment.id)}>Delete</button>
      </div>

      {replying && <CommentForm placeholder="Write a reply..." onSubmit={addReply} />}

      <div className="replies">
        {replies.map((r) => (
          <Comment key={r.id} comment={r} onDelete={deleteReply} />
        ))}
      </div>
    </div>
  );
}

function Post({ post }) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);

  const addComment = (text) => setComments([...comments, { id: Date.now(), text }]);
  const deleteComment = (id) => setComments(comments.filter((c) => c.id !== id));

  return (
    <div className="post">
      <small>c/{post.community} • Posted by u/{post.author}</small>
      <h2>{post.title}</h2>

      <div className="actions">
        <button className={liked ? "liked" : ""} onClick={() => setLiked(!liked)}>
          {liked ? "❤️" : "🤍"} {post.likes + (liked ? 1 : 0)}
        </button>
        <button onClick={() => setShowComments(!showComments)}>
          💬 {comments.length} Comments
        </button>
      </div>

      {showComments && (
        <div className="comments">
          <CommentForm placeholder="Write a comment..." onSubmit={addComment} />
          {comments.map((c) => (
            <Comment key={c.id} comment={c} onDelete={deleteComment} />
          ))}
        </div>
      )}
    </div>
  );
}

function Home() {
  return (
    <main className="container">
      <input className="create-post" placeholder="Create Post" />
      {posts.map((post) => (
        <Post key={post.id} post={post} />
      ))}
    </main>
  );
}

export default Home;