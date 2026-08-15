import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';

/* ---------------------------------------------------------------------------
   Form atoms shared by /subscribe and /onboarding. Both screens are one long
   funnel split across two routes, so they use the same field, the same error
   treatment and the same step rail rather than two that drift apart.
   --------------------------------------------------------------------------- */

/** The four steps of the funnel. Steps 1–2 live on /subscribe, 3–4 on
 *  /onboarding, and both screens render the whole rail so the visitor can see
 *  where the payment sits in the sequence. */
export const STEPS = ['Your details', 'Payment', 'Business details', 'Set password'];

export const Stepper = ({ current }) => (
  <ol className="ck-steps" aria-label="Subscription progress">
    {STEPS.map((label, i) => {
      const state = i < current ? 'done' : i === current ? 'active' : 'todo';
      return (
        <li key={label} className={`ck-step is-${state}`}>
          <span className="ck-step-dot">
            {state === 'done' ? <Check size={12} strokeWidth={4} /> : i + 1}
          </span>
          <span className="ck-step-label">{label}</span>
        </li>
      );
    })}
  </ol>
);

const ErrorLine = ({ show, children }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        className="ck-err"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
      >
        <AlertCircle size={11} /> {children}
      </motion.div>
    )}
  </AnimatePresence>
);

export const Field = ({
  id, label, value, onChange, onBlur, error, touched, type = 'text',
  placeholder, hint, maxLength, inputMode, autoComplete, uppercase, span,
}) => {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  const bad = touched && error;
  return (
    <div className={`ck-field ${bad ? 'is-bad' : ''} ${touched && !error && value ? 'is-ok' : ''}`} data-span={span}>
      <label htmlFor={id}>{label}</label>
      <div className="ck-input-wrap">
        <input
          id={id}
          type={isPw && !show ? 'password' : type === 'password' ? 'text' : type}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
          onBlur={onBlur}
          style={uppercase ? { textTransform: 'uppercase' } : undefined}
        />
        {isPw && (
          <button type="button" className="ck-eye" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="Toggle password visibility">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && !bad && <p className="ck-hint">{hint}</p>}
      <ErrorLine show={!!bad}>{error}</ErrorLine>
    </div>
  );
};

export const Select = ({ id, label, value, onChange, onBlur, error, touched, options, placeholder = 'Select…', span }) => {
  const bad = touched && error;
  return (
    <div className={`ck-field ${bad ? 'is-bad' : ''} ${touched && !error && value ? 'is-ok' : ''}`} data-span={span}>
      <label htmlFor={id}>{label}</label>
      <div className="ck-input-wrap">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <ErrorLine show={!!bad}>{error}</ErrorLine>
    </div>
  );
};

export const Textarea = ({ id, label, value, onChange, onBlur, error, touched, placeholder, rows = 3, span = 2 }) => {
  const bad = touched && error;
  return (
    <div className={`ck-field ${bad ? 'is-bad' : ''} ${touched && !error && value ? 'is-ok' : ''}`} data-span={span}>
      <label htmlFor={id}>{label}</label>
      <div className="ck-input-wrap">
        <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      </div>
      <ErrorLine show={!!bad}>{error}</ErrorLine>
    </div>
  );
};

/** Multi-select chips — used for materials, where a list of checkboxes would
 *  swamp the form and a multi-select would hide the options. */
export const ChipGroup = ({ label, options, selected, onToggle, error, touched, span = 2 }) => (
  <div className={`ck-field ${touched && error ? 'is-bad' : ''}`} data-span={span}>
    <label>{label}</label>
    <div className="ck-chips">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button type="button" key={o} className={`ck-chip ${on ? 'is-on' : ''}`} onClick={() => onToggle(o)} aria-pressed={on}>
            {on && <Check size={12} strokeWidth={4} />} {o}
          </button>
        );
      })}
    </div>
    <ErrorLine show={!!(touched && error)}>{error}</ErrorLine>
  </div>
);

/** Segmented single choice — payment method, business type, yes/no. */
export const Segments = ({ label, options, value, onChange, span = 2 }) => (
  <div className="ck-field" data-span={span}>
    {label && <label>{label}</label>}
    <div className="ck-segments">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={`ck-segment ${value === o.value ? 'is-on' : ''}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.icon && <o.icon size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

/** Small helper for the per-field touched/error bookkeeping both screens do. */
export const useFormState = (initial) => {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});

  const set = (key) => (v) => {
    setValues((p) => ({ ...p, [key]: v }));
    if (touched[key]) setErrors((p) => ({ ...p, [key]: '' }));
  };
  const blur = (key, validator) => () => {
    setTouched((p) => ({ ...p, [key]: true }));
    if (validator) setErrors((p) => ({ ...p, [key]: validator(values[key]) }));
  };
  /** Runs every validator at once; returns true when the step is clean. */
  const validateAll = (validators) => {
    const next = {};
    Object.entries(validators).forEach(([k, fn]) => { next[k] = fn(values[k]); });
    setErrors(next);
    setTouched(Object.fromEntries(Object.keys(validators).map((k) => [k, true])));
    return !Object.values(next).some(Boolean);
  };

  return { values, setValues, touched, errors, setErrors, set, blur, validateAll };
};
