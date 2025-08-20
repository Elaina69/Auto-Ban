/**
 * Formats a template string by replacing placeholders with corresponding values from the data object.
 * @param {string} template - The template string with placeholders.
 * @param {object} data - The data object containing values for placeholders.
 * @returns {string} - The formatted string.
 */
export function format(template, data = {}) {
    return template.replace(/{(\w+)}/g, (_, key) => data[key] ?? `{${key}}`);
}