export function parseBoolean (value, default_value=false) {
  /*
    Get a boolean from a Javascript object or a string from somewhere else.

    Return whether a value is truthy or falsey, with exceptions for strings of
    "false" and "0", and deferring to a default when nullish values are
    encountered.
  */

  if (typeof value === "string") {
    value = value.trim().toLowerCase();
    if (value === "false")
      return false;

    if (value === "0")
      return false;

    return true;
  }

  return Boolean(value ?? default_value)
}
