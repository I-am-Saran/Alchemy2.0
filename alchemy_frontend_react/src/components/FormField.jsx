export default function FormField({ label, type = "text", value, onChange, options = [], placeholder, readOnly = false }) {
  const id = `${label?.toLowerCase().replace(/\s+/g, '-')}-field`;

  if (type === "select") {
    return (
      <div className="grid gap-1">
        {label && <label htmlFor={id} className="text-sm text-gray-700">{label}</label>}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-transparent text-black">
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="grid gap-1">
        {label && <label htmlFor={id} className="text-sm text-gray-700">{label}</label>}
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className="min-h-28 w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      {label && <label htmlFor={id} className="text-sm text-gray-700">{label}</label>}
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
      />
    </div>
  );
}