// Frozen screen 139 (9b438485-4afa-4307-aaad-3b8cecd9a0c7):
// chip placeholders, two full store cards and a clipped next card, then rows.
// This is rendered only during a real route transition, never a timed mock AI.
export function SearchLoading() {
  return (
    <section className="search-loading" aria-label="Loading search results">
      <div className="search-loading-shapes" aria-hidden="true">
        <div className="search-loading-chips">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="search-loading-stores">
          <span />
          <span />
          <span />
        </div>
        <div className="search-loading-rows">
          <span />
          <span />
        </div>
      </div>
      <p className="search-loading-status" role="status">
        <span aria-hidden="true" />
        Loading results
      </p>
    </section>
  );
}
