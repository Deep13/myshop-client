import { useRef } from "react";

/* ── DateInput ──────────────────────────────────────────────
   Always displays dd/mm/yyyy regardless of system locale.
   value & onChange still use yyyy-mm-dd (ISO) internally.
   Clicking the input opens the native date picker.
   Pass any extra props (className, style, etc.) through.
*/
export default function DateInput({ value, onChange, style, className, ...rest }) {
  const ref = useRef();

  // yyyy-mm-dd → dd/mm/yyyy
  const display = value
    ? value.split("-").reverse().join("/")
    : "";

  const openPicker = () => {
    try { ref.current?.showPicker(); } catch { /* older browsers */ }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* visible text input */}
      <input
        type="text"
        readOnly
        value={display}
        placeholder="dd/mm/yyyy"
        onClick={openPicker}
        className={className}
        style={{ cursor: "pointer", ...style }}
        {...rest}
      />
      {/* hidden native date picker */}
      <input
        ref={ref}
        type="date"
        value={value || ""}
        onChange={onChange}
        style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%", height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
        tabIndex={-1}
      />
    </div>
  );
}
