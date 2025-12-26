/**
 * FormInput Component
 * Reusable form input/select/textarea with consistent styling
 * Eliminates duplicate className patterns across the app
 */

export default function FormInput({
  type = 'text',
  label,
  value,
  onChange,
  options = [],
  placeholder = '',
  disabled = false,
  required = false,
  multiple = false,
  rows = 4,
  ...props
}) {
  const baseClass = "w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all";

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-text mb-1">
          {label}
          {required && <span className="text-emerald-700"> *</span>}
        </label>
      )}

      {type === 'select' ? (
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          multiple={multiple}
          className={baseClass}
          {...props}
        >
          <option value="" disabled>Select {label?.toLowerCase() || 'option'}</option>
          {options.map((opt) => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          className={baseClass}
          {...props}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={baseClass}
          {...props}
        />
      )}
    </div>
  );
}
