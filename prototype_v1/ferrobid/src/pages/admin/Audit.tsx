import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge } from '../../components/ui';
import { cx } from '../../utils';

export default function Audit({ subAdminView }: { subAdminView?: boolean }) {
  const { audit } = useApp();
  const [stage, setStage] = useState('All');
  const stages = ['All', ...Array.from(new Set(audit.map((a) => a.stage)))];
  const rows = audit.filter((a) => stage === 'All' || a.stage === stage);

  return (
    <div>
      <SectionTitle
        title="Cross-stage Audit Trail" sub={subAdminView ? 'Read-only view scoped by your permissions' : 'Every action across the lot lifecycle (read-only, mock)'}
        right={<Badge tone="bg-surface-3 text-muted ring-line-strong"><ScrollText size={11} /> {rows.length} entries</Badge>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {stages.map((s) => (
          <button key={s} onClick={() => setStage(s)} className={cx('rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer ring-1 ring-inset', stage === s ? 'bg-steel-800 text-white ring-steel-800' : 'bg-surface text-muted ring-line hover:bg-surface-2')}>
            {s}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-faint">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target</th>
                <th className="px-5 py-3">Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-line hover:bg-surface-2/60">
                  <td className="px-5 py-3 whitespace-nowrap text-xs text-faint">{a.at}</td>
                  <td className="px-5 py-3">
                    <div className="text-xs font-bold text-ink">{a.actor}</div>
                    <div className="text-[10px] text-faint">{a.role}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{a.action}</td>
                  <td className="px-5 py-3 text-xs font-semibold text-steel-800 dark:text-steel-200 whitespace-nowrap">{a.target}</td>
                  <td className="px-5 py-3"><Badge tone="bg-surface-3 text-muted ring-line">{a.stage}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
