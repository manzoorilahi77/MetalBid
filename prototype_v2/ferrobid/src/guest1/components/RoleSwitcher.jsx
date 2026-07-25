import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useStore, ROLE_LABEL, ROLE_HOME, ROLE_ORDER } from '../../store/store';
import './RoleSwitcher.css';

/**
 * Demo role switcher for the Guest1 homepage navbar.
 *
 * It does NOT reimplement any role logic — it reuses the manager app's shared
 * data (ROLE_ORDER / ROLE_LABEL / ROLE_HOME) and the same `switchRole` store
 * action the Chrome header switcher uses, so behavior stays in lock-step.
 *
 * Because the homepage runs in its own <HashRouter basename="/guest1">, we can't
 * use react-router navigation to leave Guest1 (it would stay scoped under
 * /guest1). Instead we set the top-level hash directly — exactly the URL the
 * Chrome switcher's nav(ROLE_HOME[r]) produces — which the Guest1Gate observes
 * and swaps to the manager app.
 *
 * `currentRole` defaults to 'guest1' since this control lives on the Guest1
 * page; selecting the current role is a no-op. When Guest1 becomes the official
 * homepage, this component is reusable as-is (or with a different currentRole).
 */
export default function RoleSwitcher({ currentRole = 'guest1' }) {
  const switchRole = useStore((s) => s.switchRole);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onAway = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onAway);
    return () => document.removeEventListener('mousedown', onAway);
  }, [open]);

  const select = (role) => {
    setOpen(false);
    if (role === currentRole) return;            // already on Guest1 → do nothing
    switchRole(role);                            // reuse the existing store action
    window.location.hash = ROLE_HOME[role];      // leave /guest1 to the role's home
  };

  return (
    <div className="guest1-roleswitch" ref={ref}>
      <button
        type="button"
        className="guest1-roleswitch-btn"
        onClick={() => setOpen((v) => !v)}
        title="Demo role switcher"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ShieldCheck size={13} />
        <span className="guest1-roleswitch-label">Demo: {ROLE_LABEL[currentRole]}</span>
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="guest1-roleswitch-menu" role="menu">
          <div className="guest1-roleswitch-head">Jump to role</div>
          {ROLE_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              role="menuitem"
              className={`guest1-roleswitch-item${r === currentRole ? ' is-active' : ''}`}
              onClick={() => select(r)}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
