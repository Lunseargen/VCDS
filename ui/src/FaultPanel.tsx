// The side panel: an auto-scan of every module in the scan log, with the fault memory
// grouped under each module, and freeze frames. "Scan all modules" reads all the codes.
import { useMemo, useState } from 'react';
import type { ScanFault, ScanModule } from '../../src/sim/vcdsScanLog';

export type FaultWithAddress = ScanFault & { address: string };

export interface FaultPanelProps {
  modules: ScanModule[];
  faults: FaultWithAddress[];
  sourceName: string | null;
  onClear: () => void;
}

/** Group the faults by module address. */
function groupByAddress(faults: FaultWithAddress[]): Map<string, FaultWithAddress[]> {
  const byAddress = new Map<string, FaultWithAddress[]>();
  for (const fault of faults) {
    const list = byAddress.get(fault.address);
    if (list) {
      list.push(fault);
    } else {
      byAddress.set(fault.address, [fault]);
    }
  }
  return byAddress;
}

export function FaultPanel({ modules, faults, sourceName, onClear }: FaultPanelProps) {
  const [scanned, setScanned] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const byAddress = useMemo(() => groupByAddress(faults), [faults]);

  // Each module, with its own faults. A fault whose address has no module goes to an extra row.
  const rows = useMemo(() => {
    const known = modules.map((m) => ({ module: m, faults: byAddress.get(m.address) ?? [] }));
    const knownAddresses = new Set(modules.map((m) => m.address));
    const extra: Array<{ module: ScanModule; faults: FaultWithAddress[] }> = [];
    for (const [address, list] of byAddress) {
      if (!knownAddresses.has(address)) {
        extra.push({ module: { address, name: 'Unknown module', partNumber: '', component: '', coding: '', faults: [] }, faults: list });
      }
    }
    return [...known, ...extra];
  }, [modules, byAddress]);

  const modulesWithFaults = rows.filter((r) => r.faults.length > 0).length;

  if (modules.length === 0) {
    return (
      <aside className="faults">
        <h2>Modules</h2>
        <p className="muted">No scan log found.</p>
      </aside>
    );
  }

  return (
    <aside className="faults">
      <h2>Modules <span className="count">{modules.length}</span></h2>
      <button type="button" className="scan" onClick={() => setScanned(true)}>
        {scanned ? 'Scan again' : 'Scan all modules'}
      </button>
      {sourceName && <p className="muted small">Source: {sourceName} (simulated; the log does not change)</p>}

      {!scanned && (
        <>
          {modules.map((m) => (
            <div key={m.address} className="module">
              <div>
                <b>{m.address}</b> {m.name}
              </div>
              <div className="muted small">{m.partNumber} · {m.component}</div>
            </div>
          ))}
          <p className="muted small">Press "Scan all modules" to read the fault memory of every module.</p>
        </>
      )}

      {scanned && (
        <>
          <p className="summary">
            Scanned {modules.length} modules. Found {faults.length} faults in {modulesWithFaults} modules.
          </p>
          {rows.map(({ module: m, faults: list }) => (
            <div key={m.address} className="module">
              <div className="module-head">
                <span><b>{m.address}</b> {m.name}</span>
                <span className={list.length > 0 ? 'count bad' : 'count'}>{list.length}</span>
              </div>
              {list.length === 0 && <div className="muted small">No faults</div>}
              {list.map((f) => (
                <div key={`${f.address}-${f.code}`} className="fault">
                  <button type="button" className="fault-head" onClick={() => setOpen(open === `${f.address}-${f.code}` ? null : `${f.address}-${f.code}`)}>
                    <span className="code">{f.obdCode || f.code}</span> {f.name}
                  </button>
                  <div className="muted small">{f.code} · {f.detail} · {f.status.join(', ')}</div>
                  {open === `${f.address}-${f.code}` && (
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
            </div>
          ))}
          {faults.length > 0 && (
            <button type="button" className="clear" onClick={onClear}>
              Clear DTCs (simulated)
            </button>
          )}
        </>
      )}
    </aside>
  );
}
