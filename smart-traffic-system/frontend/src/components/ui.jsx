import { LEVEL } from "../api.js";

export const Chip = ({ level }) => <span className={`chip ${level}`}>{LEVEL[level].t}</span>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Demo = () => <span className="demo-tag" title="Demo data: simulated, not measured by real sensors">DEMO</span>;
export const Unavailable = ({ title, children }) => (
  <div className="unavail" role="alert"><b>{title}</b><p>{children}</p></div>
);
export function LevelGuide() {
  return (
    <div className="guide">
      {Object.values(LEVEL).map((l) => (
        <span key={l.t}><i style={{ background: l.c }} /><b>{l.t}</b> – {l.d}</span>))}
    </div>
  );
}
