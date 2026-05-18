import { useState } from "react";

export default function SmokeTSX() {
  const [n, setN] = useState(0);
  return (
    <div className="mdcc" style={{ padding: 32, fontFamily: "monospace" }}>
      <h1 data-dc-element="title">TSX smoke canvas</h1>
      <button
        type="button"
        onClick={() => setN(n + 1)}
        style={{ padding: "8px 14px", border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}
      >
        clicked {n}
      </button>
    </div>
  );
}
