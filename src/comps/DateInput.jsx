import { useRef, useState, useEffect } from "react";

/* ── DateInput ──────────────────────────────────────────────
   Always displays dd/mm/yyyy regardless of system locale.
   value & onChange still use yyyy-mm-dd (ISO) internally.
   Supports manual typing with auto-slash insertion,
   plus a calendar icon to open the native date picker.
*/
export default function DateInput({ value, onChange, style, className, ...rest }) {
  const pickerRef = useRef();
  const inputRef = useRef();

  // yyyy-mm-dd → dd/mm/yyyy
  const toDisplay = (v) => (v ? v.split("-").reverse().join("/") : "");
  // dd/mm/yyyy → yyyy-mm-dd
  const toISO = (d) => {
    const p = d.split("/");
    return p.length === 3 && p[2].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : "";
  };

  const [text, setText] = useState(toDisplay(value));

  useEffect(() => {
    if (!inputRef.current || document.activeElement !== inputRef.current) {
      setText(toDisplay(value));
    }
  }, [value]);

  const handleType = (e) => {
    let raw = e.target.value.replace(/[^0-9/]/g, "");

    // auto-insert slashes after dd and mm
    const digits = raw.replace(/\//g, "");
    if (digits.length >= 4) {
      raw = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    } else if (digits.length >= 2) {
      raw = digits.slice(0, 2) + "/" + digits.slice(2);
    } else {
      raw = digits;
    }

    setText(raw);

    // when complete (dd/mm/yyyy), fire onChange with ISO value
    if (raw.length === 10) {
      const iso = toISO(raw);
      if (iso && !isNaN(new Date(iso).getTime())) {
        onChange({ target: { value: iso } });
      }
    }
  };

  const handleBlur = () => {
    // on blur, if incomplete reset to the current value
    if (text.length < 10 || !toISO(text)) {
      setText(toDisplay(value));
    }
  };

  const openPicker = (e) => {
    e.stopPropagation();
    try { pickerRef.current?.showPicker(); } catch { /* older browsers */ }
  };

  return (
    <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={handleType}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        className={className}
        style={{ paddingRight: 22, ...style }}
        {...rest}
      />
      {/* calendar icon */}
      <span
        onClick={openPicker}
        style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          cursor: "pointer", fontSize: 14, lineHeight: 1, opacity: 0.5, userSelect: "none",
        }}
      >&#128197;</span>
      {/* hidden native date picker */}
      <input
        ref={pickerRef}
        type="date"
        value={value || ""}
        onChange={(e) => { onChange(e); setText(toDisplay(e.target.value)); }}
        style={{
          position: "absolute", top: 0, left: 0,
          width: 0, height: 0, opacity: 0, overflow: "hidden",
          pointerEvents: "none",
        }}
        tabIndex={-1}
      />
    </div>
  );
}
