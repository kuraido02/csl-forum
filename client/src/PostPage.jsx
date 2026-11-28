import "./PostPage.css";
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { getPost, fileUrl } from "./auth";
import { Author, domainOf } from "./PostParts";

function PostPage() {
  const { id } = useParams(); // the :id from the address /posts/:id

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  // Loads the post when the page opens, and again if the id in the address changes.
  useEffect(() => {
    let cancelled = false; // stops an old answer from replacing a newer one
    setLoading(true);
    setNotFound(false);
    setError("");
    setPost(null);

    getPost(id)
      .then((p) => { if (!cancelled) setPost(p); })
      .catch((err) => {
        if (cancelled) return;
        if (err.code === "NOT_FOUND") setNotFound(true);
        else setError(err.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="pp-state">Loading...</p>;

  if (notFound) {
    return (
      <main className="pp">
        <div className="pp-card pp-center">
          <h1>Post not found</h1>
          <p>
            Hindi namin mahanap ang post na ito. It may have been deleted, or
            you may not be allowed to see it.
          </p>
          <Link to="/" className="btn">Back to the feed</Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pp">
        <p className="error">{error}</p>
        <Link to="/">← Back to the feed</Link>
      </main>
    );
  }

  const image = fileUrl(post.imageUrl);
  const date = new Date(post.publishedAt || post.createdAt).toLocaleDateString();
  const review = post.review; // only the author and moderators get this

  return (
    <main className="pp">
      <Link to="/" className="pp-back">← Back to the feed</Link>

      {/* Status banners: only pending and rejected posts need one */}
      {post.status === "pending" && (
        <div className="pp-banner pending">
          <strong>Pending review.</strong> This post is not on the homepage yet.
          Only the author, the moderators of the department and admins can see it.
        </div>
      )}
      {post.status === "rejected" && (
        <div className="pp-banner rejected">
          <strong>Rejected.</strong> This post is not on the homepage.
        </div>
      )}

      <article className="pp-card">
        <div className="fd-meta">
          <Author author={post.author} />
          <span>•</span>
          <span>{post.publishedAt ? date : "Submitted " + date}</span>
          <span className="fd-pill" title={post.organization.name}>
            {post.organization.code}
          </span>
        </div>

        <h1>{post.title}</h1>

        {post.body && <p className="pp-body">{post.body}</p>}

        {image && (
          <a href={image} target="_blank" rel="noopener noreferrer">
            <img className="fd-image pp-image" src={image} alt="" />
          </a>
        )}

        {post.linkUrl && (
          <a className="fd-link" href={post.linkUrl} target="_blank" rel="noopener noreferrer">
            🔗 {domainOf(post.linkUrl)}
          </a>
        )}
      </article>

      {/* The moderator's latest decision */}
      {review && (review.note || post.status === "rejected") && (
        <div className="pp-card pp-review">
          <strong>Note from the moderator</strong>
          <p>{review.note || "No note was left."}</p>
          <small>
            {review.decision === "rejected" ? "Rejected" : "Approved"} on{" "}
            {new Date(review.reviewedAt).toLocaleDateString()}
            {review.moderator && " by u/" + review.moderator.username}
          </small>
        </div>
      )}

      {/* Moderators and admins also get the responsible department */}
      {post.department && (
        <small className="pp-dept">
          Moderating department: {post.department.code} — {post.department.name}
        </small>
      )}
    </main>
  );
}

export default PostPage;