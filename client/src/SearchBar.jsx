import "./SearchBar.css";
import { useState } from "react";

const items = [
  
  "React.js", 
  "JavaScript", 
  "HTML", 
  "CSS", 
  "Node.js", 
  "Express.js", 
  "MongoDB"

];

function SearchBar() {
  const [search, setSearch] = useState("");

  const results = items.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="search">
      <input
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {search && (
        <div className="search-results">
          {results.length > 0
            ? results.map((item) => <div key={item}>{item}</div>)
            : <div>No results found.</div>}
        </div>
      )}
    </div>
  );
}

export default SearchBar;