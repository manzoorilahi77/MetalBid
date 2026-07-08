import { Megaphone, Pin } from 'lucide-react';
import { useApp } from '../store';
import { SectionTitle, Card, Badge } from '../components/ui';

export default function Noticeboard() {
  const { notices } = useApp();
  return (
    <div>
      <SectionTitle title="Noticeboard" sub="Platform announcements and operational notices" />
      <div className="mx-auto max-w-3xl space-y-3">
        {notices.map((n) => (
          <Card key={n.id} className={n.pinned ? 'border-l-4 border-l-ember-500 p-5' : 'p-5'}>
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-steel-500/10 text-steel-700 dark:text-steel-300">
                {n.pinned ? <Pin size={17} /> : <Megaphone size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">{n.title}</h3>
                  {n.pinned && <Badge tone="bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300 ring-ember-200 dark:ring-ember-400/25">Pinned</Badge>}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{n.body}</p>
                <div className="mt-2 text-[11px] font-medium text-faint">{n.postedBy} · {n.at}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
