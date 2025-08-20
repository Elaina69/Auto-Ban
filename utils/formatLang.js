export function format(template, data = {}) {
    return template.replace(/{(\w+)}/g, (_, key) => data[key] ?? `{${key}}`);
}