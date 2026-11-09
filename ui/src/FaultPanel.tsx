// The side panel: the modules and the fault memory of the scan log, with freeze frames.
import { useState } from 'react';
import type { ScanFault, ScanModule } from '../../src/sim/vcdsScanLog';

export interface FaultPanelProps {
  modules: ScanModule[];
  faults: Array<ScanFault & { address: string }>;
  sourceName: string | null;
  onClear: () => void;
}

export function FaultPanel({ modules, faults, sourceName, onClear }: FaultPanelProps) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <aside className="faults">
      <h2>Modules</h2>
      {modules.length === 0 && <p className="muted">No scan log found.</p>}
      {modules.map((m) => (
        <div key={m.address} className="module">
          <div>
            <b>{m.address}</b> {m.name}
          </div>
          <div className="muted">
            {m.partNumber} · {m.component}
          </div>
        </div>
      ))}
      <h2>
        Fault memory <span className="count">{faults.length}</span>
      </h2>
      {sourceName && <p className="muted small">Source: {sourceName} (simulated; the log does not change)</p>}
      {faults.map((f) => (
        <div key={`${f.address}-${f.code}`} className="fault">
          <button type="button" className="fault-head" onClick={() => setOpen(open === f.code ? null : f.code)}>
            <span className="code">{f.obdCode || f.code}</span> {f.name}
          </button>
          <div className="muted small">
            {f.code} · {f.detail} · {f.status.join(', ')}
          </div>
          {open === f.code && (
            <table className="freeze">
              <tbody>
                {f.freezeFrame.length === 0 && (
                  <tr>
                    <td colSpan={2}>No freeze frame</td>
                  </tr>
                )}
                {f.freezeFrame.map((item, i) => (
                  <tr key={i}>
                    <td>{item.label}</td>
                    <td>{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {faults.length > 0 && (
        <button type="button" className="clear" onClick={onClear}>
          Clear DTCs (simulated)
        </button>
      )}
    </aside>
  );
}
