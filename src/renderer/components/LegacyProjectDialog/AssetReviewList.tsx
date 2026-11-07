import { useMemo, useState, type ReactNode } from "react";

const PAGE_SIZE = 25;
export default function AssetReviewList({
  paths,
  label,
  render,
}: {
  readonly paths: readonly string[];
  readonly label: string;
  readonly render: (path: string) => ReactNode;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      paths.filter((path) => path.toLowerCase().includes(query.toLowerCase())),
    [paths, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return (
    <section aria-label={label}>
      <label className="asset-review-search">
        Search {label.toLowerCase()}
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
      </label>
      <ul>
        {filtered
          .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
          .map((path) => (
            <li key={path}>{render(path)}</li>
          ))}
      </ul>
      {filtered.length === 0 && <p>No matching entries.</p>}
      <nav className="asset-review-pagination" aria-label={`${label} pages`}>
        <span>
          {filtered.length ? current * PAGE_SIZE + 1 : 0}–
          {Math.min((current + 1) * PAGE_SIZE, filtered.length)} of{" "}
          {filtered.length.toLocaleString()}
        </span>
        <button disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous
        </button>
        <span>
          Page {current + 1} of {pages}
        </span>
        <button
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
