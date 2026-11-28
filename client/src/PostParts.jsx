import "./Home.css"; // the .fd-* styles for the author card live here
import { fileUrl } from "./auth";

// "https://www.youtube.com/watch?v=1" -> "youtube.com"
export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The author's name and avatar, with a small card that opens on hover or tap.
export function Author({ author }) {
  // A deleted account has no username: the contract shows it as [deleted].
  if (!author || !author.username) {
    return <span className="fd-name">[deleted]</span>;
  }
  const avatar = fileUrl(author.avatarUrl);
  const who = author.displayName || author.username;

  return (
    // tabIndex={0} lets a tap or the keyboard focus it, which opens the card on phones
    <span className="fd-author" tabIndex={0}>
      <span className="fd-avatar">
        {avatar ? <img src={avatar} alt="" /> : who[0].toUpperCase()}
      </span>
      <span className="fd-name">{who}</span>

      <span className="fd-hover">
        <strong>{who}</strong>
        <span>u/{author.username}</span>
        {author.course && <span>{author.course.code} — {author.course.name}</span>}
        {author.schoolYear && <span>S.Y. {author.schoolYear}</span>}
        {author.yearLevel && <span>Year {author.yearLevel}</span>}
      </span>
    </span>
  );
}