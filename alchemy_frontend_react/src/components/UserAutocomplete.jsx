import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { get } from "../services/api";
import { THEME_COLORS } from "../constants/colors";

/**
 * Reusable User Autocomplete Component
 * Fetches users from database and displays them in a searchable dropdown
 * 
 * @param {string} value - Current selected value (user email)
 * @param {Function} onChange - Callback when value changes (receives email string)
 * @param {string} label - Label for the field
 * @param {string} placeholder - Placeholder text
 * @param {boolean} required - Whether field is required
 * @param {string} fieldType - Type of field: "assignee" or "reviewer" (for styling/context)
 * @param {object} style - Additional styles for the container
 */
export default function UserAutocomplete({
  value = "",
  onChange,
  label,
  placeholder = "Search by email...",
  required = false,
  fieldType = "assignee",
  style = {},
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState(new Map()); // Cache for search results
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounced search function
  const debouncedSearch = useCallback((query) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Check cache first
      const cacheKey = query.toLowerCase().trim();
      if (cache.has(cacheKey)) {
        setSuggestions(cache.get(cacheKey));
        setShowSuggestions(true);
        return;
      }

      setLoading(true);
      try {
        const json = await get(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (!json.error && Array.isArray(json.data)) {
          const users = json.data;
          // Cache the results
          setCache((prev) => {
            const newCache = new Map(prev);
            newCache.set(cacheKey, users);
            // Limit cache size to 50 entries
            if (newCache.size > 50) {
              const firstKey = newCache.keys().next().value;
              newCache.delete(firstKey);
            }
            return newCache;
          });
          setSuggestions(users);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.warn("Failed to search users:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce
  }, [cache]);

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    
    // If user is typing, show suggestions
    if (newValue.length >= 2) {
      debouncedSearch(newValue);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    // Update parent component
    if (onChange) {
      onChange(newValue);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (user) => {
    const email = user.email || "";
    setSearchQuery(email);
    setShowSuggestions(false);
    if (onChange) {
      // Pass user object if onChange accepts object, otherwise just email
      // Check if onChange accepts second parameter for user object
      onChange(email, user);
    }
    inputRef.current?.blur();
  };

  // Handle input focus
  const handleFocus = () => {
    if (searchQuery.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    } else if (searchQuery.length >= 2) {
      debouncedSearch(searchQuery);
    }
  };

  // Handle input blur (with delay to allow click on suggestion)
  const handleBlur = () => {
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 200);
  };

  // Sync searchQuery with value prop
  useEffect(() => {
    if (value !== searchQuery) {
      setSearchQuery(value || "");
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", ...style }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: "500",
            color: "#374151",
            marginBottom: "0.5rem",
          }}
        >
          {label}
          {required && <span style={{ color: "#ef4444", marginLeft: "0.25rem" }}>*</span>}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            border: `1px solid ${THEME_COLORS.lightBlue}`,
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            boxSizing: "border-box",
            outline: "none",
            transition: "all 0.2s ease",
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowSuggestions(false);
              inputRef.current?.blur();
            } else if (e.key === "ArrowDown" && suggestions.length > 0) {
              e.preventDefault();
              const firstSuggestion = dropdownRef.current?.querySelector("button");
              firstSuggestion?.focus();
            }
          }}
        />
        {loading && (
          <div
            style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            Searching...
          </div>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            backgroundColor: "#ffffff",
            border: `1px solid ${THEME_COLORS.lightBlue}`,
            borderRadius: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            zIndex: 1000,
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((user) => (
            <button
              key={user.id || user.email}
              type="button"
              onClick={() => handleSelectSuggestion(user)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.75rem 1rem",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "#374151",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSelectSuggestion(user);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = e.currentTarget.nextElementSibling;
                  if (next) next.focus();
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const prev = e.currentTarget.previousElementSibling;
                  if (prev) {
                    prev.focus();
                  } else {
                    inputRef.current?.focus();
                  }
                }
              }}
            >
              <div style={{ fontWeight: "500", color: THEME_COLORS.darkTeal }}>
                {user.email || "No email"}
              </div>
              {user.full_name && (
                <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
                  {user.full_name}
                </div>
              )}
              {user.department && (
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.125rem" }}>
                  {user.department}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {showSuggestions && !loading && suggestions.length === 0 && searchQuery.length >= 2 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            backgroundColor: "#ffffff",
            border: `1px solid ${THEME_COLORS.lightBlue}`,
            borderRadius: "0.5rem",
            padding: "1rem",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "0.875rem",
            zIndex: 1000,
          }}
        >
          No users found
        </div>
      )}
    </div>
  );
}

