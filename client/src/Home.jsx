import "./Home.css";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPosts, getOrganizations, fileUrl } from "./auth";
import { Author, domainOf } from "./PostParts";


function PostCard({ post }) {
  const image = fileUrl(post.imageUrl);
  const when = new Date(post.publishedAt || post.createdAt).toLocaleDateString();

  return (
    <article className="fd-post">
      <div className="fd-meta">
        <Author author={post.author} />
        <span>•</span>
        <span>{when}</span>
        <span className="fd-pill">{post.organization.code}</span>
      </div>

      <h2><Link to={"/posts/" + post.id}>{post.title}</Link></h2>

      {post.excerpt && (
        <p className="fd-excerpt">
          {post.excerpt}{post.excerpt.length >= 300 ? "…" : ""}
        </p>
      )}

      {image && <img className="fd-image" src={image} alt="" />}

      {post.linkUrl && (
        <a className="fd-link" href={post.linkUrl} target="_blank" rel="noopener noreferrer">
          🔗 {domainOf(post.linkUrl)}
        </a>
      )}
    </article>
  );
}

function Home({ user }) {
  const loggedIn = Boolean(user);

  const [organizations, setOrganizations] = useState([]);
  const [organization, setOrganization] = useState(""); // "" means all
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the organization pills once, when a logged-in user opens the page.
  useEffect(() => {
    if (!loggedIn) return;
    getOrganizations().then(setOrganizations).catch(() => {});
  }, [loggedIn]);

  // Load the posts whenever the filter or the page changes.
  useEffect(() => {
    if (!loggedIn) return;

    let cancelled = false; // set to true when this request becomes out of date
    setLoading(true);
    setError("");

    getPosts(organization, page)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    // React runs this when the filter or page changes again. If the user taps
    // two pills quickly, the slow answer of the first tap must not replace the
    // answer of the second one.
    return () => { cancelled = true; };
  }, [loggedIn, organization, page]);

  function changeOrganization(code) {
    setOrganization(code);
    setPage(1); // a new filter starts on page 1
  }

  function goToPage(p) {
    setPage(p);
    window.scrollTo({ top: 0 });
  }

  // Guests: no request is sent, because the server would answer 401.
  if (!loggedIn) {
    return (
      <main className="feed">
        <div className="fd-welcome">
          <h1>Kumusta! Welcome to TALAVYN</h1>
          <p>The forum for our school's students and teachers. Log in to read and share posts.</p>
          <div className="fd-actions">
            <Link to="/login" className="btn">Log In</Link>
            <Link to="/signup" className="btn outline">Sign Up</Link>
          </div>
        </div>
      </main>
    );
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <main className="feed">
      <div className="fd-filters">
        <button className={organization === "" ? "active" : ""}
          onClick={() => changeOrganization("")}>
          All
        </button>
        {organizations.map((o) => (
          <button key={o.id} title={o.name}
            className={organization === o.code ? "active" : ""}
            onClick={() => changeOrganization(o.code)}>
            {o.code}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {loading && <p className="fd-empty">Loading...</p>}

      {!loading && !error && data.items.length === 0 && (
        <p className="fd-empty">Wala pang posts dito.</p>
      )}

      {!loading && data.items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {!loading && data.total > data.pageSize && (
        <div className="fd-pager">
          <button className="btn outline" disabled={page <= 1}
            onClick={() => goToPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn outline" disabled={page >= pages}
            onClick={() => goToPage(page + 1)}>Next</button>
        </div>
      )}
    </main>
  );
}

export default Home;